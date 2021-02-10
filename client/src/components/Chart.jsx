import React from 'react';
import { connect } from 'react-redux';
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, ReferenceLine, ReferenceArea,
    ReferenceDot, Tooltip, CartesianGrid, Legend, Brush, ErrorBar, AreaChart, Area,
    Label, LabelList, Scatter
} from 'recharts';
import distinctColors from 'distinct-colors'
import './Chart.css';
import RSI from "./indicators/RSI";
import MACD from "./indicators/MACD";
import ADX from "./indicators/ADX";
import Stochastic from "./indicators/Stochastic";
import Loading from './Loading';
import { formatDate, numberWithCommas, displayDelta } from '../helpers/utils';

class Chart extends React.Component {
    constructor(props) {
        super(props);

        // constants
        this.indicatorCharts = { "RSI": RSI, "MACD": MACD, "ADX": ADX, "Stochastic": Stochastic };
        this.overlayCharts = ["SMA", "GC", "EMA", "Structure", "Pullback", "Breakout", "ATR", "Swing", "Divergence", "Trend", "Candle"];
        this.chunkSize = 500;
        this.scrollThreshold = .025;
        this.eventMargin = .1;

        // start of chunk
        this.startIndex = 0;
        this.minThreshold = Math.floor(this.chunkSize * this.scrollThreshold);
        this.maxThreshold = Math.floor(this.chunkSize * (1 - this.scrollThreshold));

        // maps a buy date to its stoploss/target 
        this.stoplossTarget = {};
        // map a buy/sell date to its event 
        this.eventsLookup = {};

        this.state = {
            priceGraph: [],
            buyDates: new Set(),
            sellDates: new Set(),
            holdings: {},
            myOverlayCharts: [],
            startBrushIndex: this.chunkSize - Math.floor(this.chunkSize / 4),
            endBrushIndex: this.chunkSize - 1,
            supportLevels: [],
            resistanceLevels: [],
            supportResistanceLevels: [],
            loading: true
        }
    }

    componentDidMount() {
        if (this.props.symbol != "") {
            this.newSymbol = true;
            // track buy/sell events
            this.updateBuySellEvents();
            // fetch graph data
            this.fetchData();
        }
    }

    componentDidUpdate(prevProps) {
        console.log("updating chart");
        console.log(this.props);
        // if symbol, indicator, or event index changed
        if (this.props.symbol != "" &&
            (this.props.symbol !== prevProps.symbol || this.props.activeIndicators.length != prevProps.activeIndicators.length || this.props.eventIndex != prevProps.eventIndex)) {
            // if new symbol
            if (this.props.symbol !== prevProps.symbol) {
                console.log("NEW SYMBOL!");
                this.newSymbol = true;
                this.updateBuySellEvents();
                this.fetchData();
            }
            // if new indicator settings
            else if (this.props.activeIndicators.length != prevProps.activeIndicators.length) {
                console.log("NEW INDICATORS!");
                this.fetchData();
            }
            // if new event
            else if (this.props.eventIndex != prevProps.eventIndex) {
                console.log("NEW EVENT!");
                this.goToEvent();
            }
        }
    }

    updateBuySellEvents() {
        console.log("before fetch");
        // store results to refer back
        let results = this.props.results;
        console.log(results);
        let events = this.props.results["events"];
        // cache all buy/sell dates for quick access
        let buyDates = new Set();
        let sellDates = new Set();
        let holdings = {};
        results["holdings"].forEach(holding => {
            holdings[holding["buyDate"]] = holding;
        })
        this.eventsLookup = {};
        events.forEach(event => {
            buyDates.add(event["buyDate"]);
            sellDates.add(event["sellDate"]);
            this.eventsLookup[event["buyDate"]] = { type: "buy", event: event };
            this.eventsLookup[event["sellDate"]] = { type: "sell", event: event };
        });
        this.setState({ buyDates, sellDates, holdings });
        this.stoplossTarget = {};
    }

    fetchData = () => {
        let finalOptions = {};
        this.props.activeIndicators.forEach(activeIndicator => {
            finalOptions[activeIndicator] = this.props.indicatorOptions[activeIndicator];
        });
        let graphData = { symbol: this.props.symbol, indicators: finalOptions };

        fetch(`${process.env.NODE_ENV == "production" ? process.env.REACT_APP_SUBDIRECTORY : ""}/priceGraph`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(graphData)
        })
            .then(res => res.json())
            .then(async graphs => {
                // save graphs to load chunks later
                this.graphs = graphs;
                console.log("received data from server");

                let myOverlayCharts = [];
                let indicatorGraphs = graphs["indicators"];

                // initialize indicator graphs
                Object.keys(indicatorGraphs).forEach(indicatorName => {
                    // overlays store data with symbol price
                    if (this.overlayCharts.includes(indicatorName)) {
                        let graphNames = Object.keys(indicatorGraphs[indicatorName]);
                        myOverlayCharts = myOverlayCharts.concat(graphNames);
                    }
                });
                this.setState({ myOverlayCharts });

                // if loading new symbol
                if (this.newSymbol) {
                    this.newSymbol = false;

                    // cache sorted date array for finding events
                    this.dates = [];
                    graphs["price"].forEach(day => {
                        this.dates.push(day["date"]);
                    });

                    // cache support and resistance info
                    await this.getSupportResistance();

                    // set brush range
                    // if large enough to be chunked
                    if (graphs["price"].length > this.chunkSize) {
                        // set brush to end
                        this.setState({ startBrushIndex: this.chunkSize - Math.floor(this.chunkSize / 4), endBrushIndex: this.chunkSize - 1 });
                        // load most recent chunk
                        this.startIndex = graphs["price"].length - this.chunkSize;
                    }
                    else {
                        // set brush to cover everything
                        this.setState({ startBrushIndex: 0, endBrushIndex: graphs["price"].length - 1 });
                        this.startIndex = 0;
                    }
                    this.goToEvent();
                }
                // if updating indicators
                else {
                    // go back to the event user was looking at
                    this.goToEvent();
                }
            })
    }

    goToEvent = async () => {
        if (this.props.eventIndex == -1) {
            // update indicator changes
            this.loadChunk();
            return;
        }
        let events = this.props.results["events"];
        // get event info
        let event = events[this.props.eventIndex];
        let buyDateIndex = this.dates.indexOf(event["buyDate"]);
        let sellDateIndex = this.dates.indexOf(event["sellDate"]);

        // left/right margin from buy and sells
        let brushMarginSize;
        let max = 0;
        let min = 0;

        // set full view
        // If chunkable
        if (this.graphs["price"].length > this.chunkSize) {
            // place event in the center of the chunk
            let chunkMarginSize = Math.floor((this.chunkSize - (sellDateIndex - buyDateIndex)) / 2);
            this.startIndex = Math.max(0, buyDateIndex - chunkMarginSize);
            // max/min at ends of chunk
            max = this.maxThreshold;
            min = this.minThreshold;
            // base margin on chunk size
            brushMarginSize = Math.floor(this.chunkSize * this.eventMargin)
        }
        // View entire chunk
        else {
            this.startIndex = 0;
            // max/min at ends of price
            max = this.graphs["price"].length - 1;
            min = 0;
            // base margin on price size
            brushMarginSize = Math.floor(this.graphs["price"].length * this.eventMargin)
        }

        await this.loadChunk();

        // set brush view
        let startBrushIndex;
        let endBrushIndex;
        if (this.props.chartSettings["Test Mode"]) {
            // place buy at the end
            startBrushIndex = Math.max(min, buyDateIndex - this.startIndex - brushMarginSize);
            endBrushIndex = Math.min(max, buyDateIndex - this.startIndex);
        }
        else {
            // place brush around buy/sell events
            startBrushIndex = Math.max(min, buyDateIndex - this.startIndex - brushMarginSize);
            endBrushIndex = Math.min(max, sellDateIndex - this.startIndex + brushMarginSize);
            // for recent events where not a full chunk is loaded
            console.log(this.state.priceGraph.length, this.chunkSize);
            if (this.state.priceGraph.length < this.chunkSize) {
                endBrushIndex = Math.min(endBrushIndex, this.state.priceGraph.length - 2);
            }
        }
        this.setState({ startBrushIndex, endBrushIndex }, () => {
            this.refreshGraph();
        });
    }

    xAxisTickFormatter = (value) => {
        return formatDate(new Date(value));
    }

    labelFormatter = (label) => {
        let stoploss = undefined;
        let target = undefined;
        let profit = undefined;
        // show stoploss/target on buy events
        if (this.stoplossTarget[label]) {
            stoploss = this.stoplossTarget[label]["stoploss"];
            target = this.stoplossTarget[label]["target"];
        }
        // show profit on sell events
        if (this.eventsLookup.hasOwnProperty(label) && this.eventsLookup[label]["type"] == "sell") {
            profit = this.eventsLookup[label]["event"]["profit"];
        }
        let volume = this.graphs["volumes"][label];
        if (volume) {
            volume = ` (${numberWithCommas(volume)})`
        }
        else {
            volume = "";
        }
        return <>
            {formatDate(label) + volume}
            <br />
            {target ? (<>{`🎯: $${target.toFixed(2)} (${this.stoplossTarget[label]["target%"].toFixed(2)}%)`}<br /></>) : ""}
            {stoploss ? (<>{`🛑: $${stoploss.toFixed(2)} (${this.stoplossTarget[label]["stoploss%"].toFixed(2)}%)`}<br /></>) : ""}
            {profit ? (<>{`💸: $${profit.toFixed(2)} (${displayDelta(this.eventsLookup[label]["event"]["percentProfit"] * 100)}%)`}<br /></>) : ""}
        </>
    }

    tooltipFormatter = (value, name, props) => {
        if (name == "price") {
            return [value.toFixed(4), this.props.symbol];
        }
        if (value) {
            try {
                return value.toFixed(4);
            }
            catch {
                if (typeof value == "object") {
                    return "";
                }
                return value;
            }
        }
    }

    brushFormatter = (value) => {
        return formatDate(value);
    }

    onBrushChange = (newRange) => {
        let newStart = newRange["startIndex"];
        let newEnd = newRange["endIndex"];
        // entered previous area
        if (newStart < this.minThreshold && this.startIndex > 0) {
            // move left by 25% of the chunk
            let oldStart = this.startIndex;
            this.startIndex = Math.floor(Math.max(0, this.startIndex - this.chunkSize * .25));
            this.loadChunk();

            // adjust the brush
            let shiftAmount = oldStart - this.startIndex;
            let startBrushIndex = Math.max(this.minThreshold, newStart + shiftAmount);
            let endBrushIndex = Math.min(this.maxThreshold, newEnd + shiftAmount);
            this.setState({ startBrushIndex, endBrushIndex });
        }
        // entered next area and not already at the end
        else if (newEnd > this.maxThreshold && this.startIndex < this.graphs["price"].length - this.chunkSize) {
            // move right by 25% of the chunk
            let oldStart = this.startIndex;
            this.startIndex = Math.floor(Math.min(this.graphs["price"].length - this.chunkSize, this.startIndex + this.chunkSize * .25));
            this.loadChunk();

            // adjust the brush
            let shiftAmount = this.startIndex - oldStart;
            let startBrushIndex = Math.max(this.minThreshold, newStart - shiftAmount);
            let endBrushIndex = Math.min(this.maxThreshold, newEnd - shiftAmount);
            this.setState({ startBrushIndex, endBrushIndex });
        }
    }

    loadChunk = () => {
        return new Promise(res => {
            let priceGraph = [];
            let myindicatorGraphs = {};
            let indicatorGraphs = this.graphs["indicators"];

            // initialize indicator graphs
            Object.keys(indicatorGraphs).forEach(indicatorName => {
                // non-overlays have their own lists in state
                if (!this.overlayCharts.includes(indicatorName)) {
                    myindicatorGraphs[indicatorName] = [];
                }
            });

            // only load a certain chunk for better performance
            let days = this.graphs["price"];
            days = days.slice(this.startIndex, this.startIndex + this.chunkSize);

            console.log("Loading chunks for", Object.keys(indicatorGraphs));

            if (this.supportLevels && days.length > 0) {
                // only load support/resistance levels in range
                let firstDay = new Date(days[0]["date"]);
                let lastDay = new Date(days[days.length - 1]["date"]);
                let supportLevels = [];
                let resistanceLevels = [];
                let supportResistanceLevels = [];
                Object.keys(this.supportLevels).forEach(groupAvg => {
                    let end = new Date(this.supportLevels[groupAvg]["end"]);
                    let start = new Date(this.supportLevels[groupAvg]["start"]);
                    if (end > firstDay && end < lastDay || start > firstDay && start < lastDay) {
                        supportLevels.push(groupAvg);
                    }
                });
                Object.keys(this.resistanceLevels).forEach(groupAvg => {
                    let end = new Date(this.resistanceLevels[groupAvg]["end"]);
                    let start = new Date(this.resistanceLevels[groupAvg]["start"]);
                    if (end > firstDay && end < lastDay || start > firstDay && start < lastDay) {
                        resistanceLevels.push(groupAvg);
                    }
                });
                Object.keys(this.supportResistanceLevels).forEach(groupAvg => {
                    let end = new Date(this.supportResistanceLevels[groupAvg]["end"]);
                    let start = new Date(this.supportResistanceLevels[groupAvg]["start"]);
                    let count = this.supportResistanceLevels[groupAvg]["count"]
                    if (end > firstDay && end < lastDay || start > firstDay && start < lastDay) {
                        supportResistanceLevels.push({ price: groupAvg, count });
                    }
                });
                this.setState({ supportLevels, resistanceLevels, supportResistanceLevels });
            }

            // fill in graphs
            days.forEach(day => {
                // for price
                let adjScale = day["adjClose"] / day["close"];
                let date = day["date"];
                let close = day["adjClose"];
                let open = day["open"] * adjScale;
                let low = day["low"] * adjScale;
                let high = day["high"] * adjScale;
                // candles
                let greenCandleBody = close >= open ? [close - open, 0] : undefined;
                let redCandleBody = close < open ? [0, open - close] : undefined;
                let candleWick = [close - low, high - close];
                // stoploss/target
                let atr = this.graphs["atr"]["ATR"];
                let stoploss = this.getStoploss(date, atr, close, low);
                let target = this.getTarget(date, atr, close, low);
                let priceEntry = { date, price: close, redCandleBody, greenCandleBody, candleWick, stoploss, target };

                // for indicators
                Object.keys(indicatorGraphs).forEach(indicatorName => {
                    // overlays store data with symbol price
                    if (this.overlayCharts.includes(indicatorName)) {
                        let graphNames = Object.keys(indicatorGraphs[indicatorName]);
                        graphNames.forEach(graphName => {
                            priceEntry[graphName] = indicatorGraphs[indicatorName][graphName][date];
                        })
                    }
                    // non-overlays have their own lists
                    else {
                        let entry = { date };
                        // each indicator may have multiple graphs
                        let graphNames = Object.keys(indicatorGraphs[indicatorName]);
                        graphNames.forEach(graphName => {
                            entry[graphName] = indicatorGraphs[indicatorName][graphName][date];
                        })
                        myindicatorGraphs[indicatorName].push(entry)
                    }
                });

                priceGraph.push(priceEntry);
            });

            this.setState(myindicatorGraphs);
            this.setState({ priceGraph }, () => {
                res();
                this.setState({ loading: false });
            });
        });
    }

    getStoploss = (date, atr, close, low) => {
        let stoploss = undefined;
        // for buy events
        if (this.eventsLookup[date] && this.eventsLookup[date]["type"] == "buy") {
            let event = this.eventsLookup[date]["event"];
            if (event["risk"]) {
                stoploss = close * (100 - event["risk"]) / 100;
            }
        }

        // for holdings
        if (this.state.holdings.hasOwnProperty(date)) {
            let holding = this.state.holdings[date];
            stoploss = holding["stoplossTarget"]["initStoploss"];
        }

        if (stoploss) {
            // cache stoploss
            if (!this.stoplossTarget.hasOwnProperty(date)) {
                this.stoplossTarget[date] = {};
            }
            this.stoplossTarget[date]["stoploss"] = stoploss;
            this.stoplossTarget[date]["stoploss%"] = (close - stoploss) / close * 100;
            // return error bar format
            return [close - stoploss, 0];
        }
    }

    getTarget = (date, atr, close, low) => {
        // only show for buy dates
        if (!this.state.buyDates.has(date) && !this.state.holdings.hasOwnProperty(date)) {
            return undefined;
        }

        let target = undefined;
        if (this.props.strategyOptions["stopLossHigh"]) {
            target = this.props.strategyOptions["stopLossHigh"] * close;
        }
        else if (this.props.strategyOptions["targetAtr"]) {
            target = close + this.props.strategyOptions["targetAtr"] * atr[date];
        }
        else if (this.props.strategyOptions["riskRewardRatio"]) {
            let stopLoss = low - this.props.strategyOptions["stopLossAtr"] * atr[date];
            // for buy events
            if (this.eventsLookup[date] && this.eventsLookup[date]["type"] == "buy") {
                let event = this.eventsLookup[date]["event"];
                if (event["risk"]) {
                    stopLoss = close * (100 - event["risk"]) / 100;
                }
            }

            // for holdings
            if (this.state.holdings.hasOwnProperty(date)) {
                let holding = this.state.holdings[date];
                stopLoss = holding["stoplossTarget"]["initStoploss"];
            }

            target = close + this.props.strategyOptions["riskRewardRatio"] * (close - stopLoss);
        }

        if (target) {
            // cache target
            if (!this.stoplossTarget.hasOwnProperty(date)) {
                this.stoplossTarget[date] = {};
            }
            this.stoplossTarget[date]["target"] = target;
            this.stoplossTarget[date]["target%"] = (target - close) / close * 100;
            // return error bar format
            return [0, target - close];
        }
    }

    refreshGraph = () => {
        let priceGraph = [...this.state.priceGraph];
        let missing = priceGraph.pop();
        this.setState({ priceGraph }, () => {
            priceGraph.push(missing);
            this.setState({ priceGraph });
        });
    }

    wheelHandler = (e) => {
        // scroll up/zoom in
        if (e.deltaY < 0) {
        }
        // scroll down/zoom out
        else {
        }
    }

    getSupportResistance = () => {
        return new Promise((resolve, reject) => {
            // let data = { indicatorName: "Swing", indicatorOptions: { "period": 3, "volatility": .05 }, symbol: this.props.symbol };
            // fetch(`${process.env.NODE_ENV == "production" ? process.env.REACT_APP_SUBDIRECTORY : ""}/indicatorGraph`, {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json'
            //     },
            //     body: JSON.stringify(data)
            // })
            //     .then(res => res.json())
            //     .then(pivots => {
            //         try {
            //             this.setState({ pivots: Object.keys(pivots["pivots"]) });
            //         }
            //         catch {

            //         }
            //     })

            let graphData = { indicatorName: "EMA", indicatorOptions: { "period": 5 }, symbol: this.props.symbol };

            fetch(`${process.env.NODE_ENV == "production" ? process.env.REACT_APP_SUBDIRECTORY : ""}/indicatorGraph`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(graphData)
            })
                .then(res => res.json())
                .then(smoothedGraph => {
                    smoothedGraph = smoothedGraph["EMA(5)"];
                    let resistanceLevels = [];
                    let supportLevels = [];
                    let days = this.graphs["price"];
                    let previousPrice = smoothedGraph[days[0]["date"]];
                    let previousSlope = "P";
                    for (let i = 1; i < days.length; ++i) {
                        let day = days[i];
                        let date = day["date"];
                        let price = day["adjClose"];
                        let difference = smoothedGraph[date] - previousPrice;
                        // if has a direction, check for possible reversal
                        if (difference != 0) {
                            let slope = difference > 0 ? "P" : "N";
                            // different slope
                            if (previousSlope != slope) {
                                // if slope up, is support
                                if (slope == "P") {
                                    // look for local min
                                    let minIndex = i;
                                    while (minIndex > 1) {
                                        if (days[minIndex - 1]["adjClose"] > days[minIndex]["adjClose"]) break;
                                        minIndex--;
                                    }
                                    supportLevels.push({ price: days[minIndex]["adjClose"], date: new Date(days[minIndex]["date"]) });
                                }
                                // if slow down, is support
                                else if (slope == "N") {
                                    // look for local max
                                    let maxIndex = i;
                                    while (maxIndex > 1) {
                                        if (days[maxIndex - 1]["adjClose"] < days[maxIndex]["adjClose"]) break;
                                        maxIndex--;
                                    }
                                    resistanceLevels.push({ price: days[maxIndex]["adjClose"], date: new Date(days[maxIndex]["date"]) });
                                }
                            }
                            previousSlope = slope;
                        }
                        previousPrice = smoothedGraph[date];
                    }

                    // merge similar support and resistances
                    this.supportLevels = this.mergeLevels(supportLevels);
                    this.resistanceLevels = this.mergeLevels(resistanceLevels);

                    // merge support and resistance
                    this.mergeSupportResistance();

                    let cutoff = 25;
                    // view raw support/resistance levels, verbose
                    // this.setState({ supportLevels: supportLevels.splice(supportLevels.length - cutoff, cutoff), resistanceLevels: resistanceLevels.splice(resistanceLevels.length - cutoff, cutoff) });
                    resolve();
                });
        });
    }

    mergeSupportResistance = () => {
        let similarityThreshold = .05;
        let merged = { ...this.supportLevels };
        Object.keys(this.resistanceLevels).forEach(resistanceLevel => {
            let level = this.resistanceLevels[resistanceLevel];
            let groupMatch = undefined;
            let groupAverages = Object.keys(merged);
            // look for a group that is close to this level
            for (let i = 0; i < groupAverages.length; ++i) {
                let groupAverage = groupAverages[i];
                if (groupAverage * (1 + similarityThreshold) > resistanceLevel && groupAverage * (1 - similarityThreshold) < resistanceLevel) {
                    groupMatch = groupAverage;
                    break;
                }
            }
            // if found an agreeing support, add to group
            if (groupMatch) {
                // remove from support/resistance
                if (this.supportLevels.hasOwnProperty(groupMatch)) {
                    delete this.supportLevels[groupMatch];
                }
                if (this.resistanceLevels.hasOwnProperty(resistanceLevel)) {
                    delete this.resistanceLevels[resistanceLevel];
                }
                let oldStart = merged[groupMatch]["start"];
                let oldEnd = merged[groupMatch]["end"];
                let oldCount = merged[groupMatch]["count"];
                let newStart = oldStart < level["start"] ? oldStart : level["start"];
                let newEnd = oldEnd > level["end"] ? oldEnd : level["end"];
                let newCount = oldCount + level["count"];
                let newAverage = (groupMatch * oldCount + resistanceLevel * level["count"]) / newCount;
                delete merged[groupMatch];
                merged[newAverage] = { count: newCount, end: newEnd, start: newStart, merged: true };
            }
        });
        // remove unmerged levels
        Object.keys(merged).forEach(level => {
            if (!merged[level]["merged"]) {
                delete merged[level];
            }
        });
        this.supportResistanceLevels = merged;
    }

    // takes volatile support and resistance levels, and merges similar levels 
    mergeLevels = (levels) => {
        let similarityThreshold = .05;
        let merged = {};
        levels.forEach(level => {
            let groupMatch = undefined;
            let groupAverages = Object.keys(merged);
            // look for a group that is close to this level
            for (let i = 0; i < groupAverages.length; ++i) {
                let groupAverage = groupAverages[i];
                if (groupAverage * (1 + similarityThreshold) > level["price"] && groupAverage * (1 - similarityThreshold) < level["price"]) {
                    groupMatch = groupAverage;
                    break;
                }
            }
            // if found a group, add to group
            if (groupMatch) {
                let oldStart = merged[groupMatch]["start"];
                let oldCount = merged[groupMatch]["count"];
                let newCount = oldCount + 1;
                let newAverage = (groupMatch * oldCount + level["price"]) / newCount;
                delete merged[groupMatch];
                merged[newAverage] = { count: newCount, end: level["date"], start: oldStart };
            }
            // if not found, create a group
            else {
                merged[level["price"]] = { count: 1, end: level["date"], start: level["date"] };
            }
        });
        return merged;
    }

    render() {
        console.log(this.state);
        // if no symbol, return
        if (!this.props.symbol) {
            return <span className="chart-missing">Run a Strategy!</span>
        }
        let margins = { top: 20, right: 40, bottom: 20, left: 20 };
        let sideChartHeight = 15;
        let mainChartHeight = 100 - (this.props.activeIndicators.filter(i => !this.overlayCharts.includes(i)).length + 1) * sideChartHeight;

        // Brushes
        let mainBrush = <Brush gap={1} height={65} dataKey="date" startIndex={this.state.startBrushIndex} endIndex={this.state.endBrushIndex} onChange={this.onBrushChange} tickFormatter={this.brushFormatter}>
            <AreaChart>
                <CartesianGrid horizontal={false} />
                <YAxis hide domain={['auto', 'auto']} />
                <Area dataKey="price" stroke="#ff7300" fill="#ff7300" dot={<this.CustomizedDot size={3} />} />
            </AreaChart>
        </Brush>;
        let hiddenBrush = <Brush gap={1} width={0} height={0.00001} dataKey="date" startIndex={this.state.startBrushIndex} endIndex={this.state.endBrushIndex} />;
        let simpleTooltip = <Tooltip
            wrapperStyle={{
                borderColor: 'white',
                boxShadow: '2px 2px 3px 0px rgb(204, 204, 204)',
            }}
            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
            labelStyle={{ fontWeight: 'bold', color: '#666666' }}
            formatter={this.tooltipFormatter}
            labelFormatter={(label) => formatDate(label)}
        />;
        let tooltip = <Tooltip
            wrapperStyle={{
                borderColor: 'white',
                boxShadow: '2px 2px 3px 0px rgb(204, 204, 204)',
            }}
            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
            labelStyle={{ fontWeight: 'bold', color: '#666666' }}
            formatter={this.tooltipFormatter}
            labelFormatter={this.labelFormatter}
        />;

        // Main Line
        let mainLine = <Line dataKey="price" stroke="#ff7300" dot={<this.CustomizedDot size={10} />}>
            <ErrorBar dataKey="greenCandleBody" width={0} strokeWidth={5} stroke="green" direction="y" />
            <ErrorBar dataKey="redCandleBody" width={0} strokeWidth={5} stroke="red" direction="y" />
            <ErrorBar dataKey="candleWick" width={1} strokeWidth={1} stroke="black" direction="y" />
            <ErrorBar dataKey="stoploss" width={15} strokeWidth={1} stroke="red" direction="y" />
            <ErrorBar dataKey="target" width={15} strokeWidth={1} stroke="green" direction="y" />
        </Line>;
        if (!this.props.chartSettings["Candles"]) {
            mainLine = <Line dataKey="price" stroke="#ff7300" dot={<this.CustomizedDot size={10} />}>
                <ErrorBar dataKey="stoploss" width={15} strokeWidth={1} stroke="red" direction="y" />
                <ErrorBar dataKey="target" width={15} strokeWidth={1} stroke="green" direction="y" />
            </Line>;
        }

        // Support Resistance Lines
        let supportResistanceLines = this.state.supportResistanceLevels.map(sr => <ReferenceLine y={sr["price"]} stroke="black" strokeDasharray="3 3" />);
        if (!this.props.chartSettings["Support Lines"]) {
            supportResistanceLines = <></>;
        }

        console.log("CHART SETTINGS", this.props.chartSettings);

        return (
            <div className="chart-container" onWheel={this.wheelHandler}>
                <Loading loading={this.state.loading} />
                {/* Main Chart */}
                <ResponsiveContainer width="100%" height={`${mainChartHeight}%`}>
                    <LineChart data={this.state.priceGraph} syncId="graph" margin={margins}>
                        <CartesianGrid vertical={false} horizontal={false} />
                        <XAxis dataKey="date" minTickGap={50} height={25} tickFormatter={this.xAxisTickFormatter} />
                        <YAxis domain={["auto", "auto"]} orientation="left" />
                        {/* Main Line */}
                        {mainLine}
                        {/* Overlay Charts */}
                        {
                            this.state.myOverlayCharts.length > 0 && this.state.myOverlayCharts.map((overlay, index) => {
                                let colors = distinctColors({ count: this.state.myOverlayCharts.length, lightMin: 50 });
                                return <Line key={overlay} dataKey={overlay} strokeWidth={3} stroke={`${colors[index].hex()}`} dot={false} />
                            })
                        }
                        {/* Support and Resistance Lines */}
                        {supportResistanceLines}
                        {/* {
                            this.state.supportLevels.map(support => <ReferenceLine y={support} stroke="green" strokeDasharray="3 3" />)
                        }
                        {
                            this.state.resistanceLevels.map(resistance => <ReferenceLine y={resistance} stroke="red" strokeDasharray="3 3" />)
                        } */}
                        {hiddenBrush}
                        {tooltip}
                    </LineChart>
                </ResponsiveContainer>
                {/* Sub Charts */}
                {
                    this.props.activeIndicators.map((indicatorName, index) => {
                        if (this.overlayCharts.includes(indicatorName)) {
                            return;
                        }
                        let ChartClass = this.indicatorCharts[indicatorName];
                        let chart = <ChartClass graph={this.state[indicatorName]} xAxisTickFormatter={this.xAxisTickFormatter}
                            options={this.props.indicatorOptions[indicatorName]} brush={hiddenBrush} tooltip={simpleTooltip} />

                        return <ResponsiveContainer width="100%" height={`${sideChartHeight}%`} key={`${this.props.symbol}-chart-${index}`} >
                            {chart}
                        </ResponsiveContainer>
                    })
                }
                {/* Main Brush */}
                <ResponsiveContainer width="100%" height={75}>
                    <LineChart data={this.state.priceGraph} syncId="graph" margin={{ top: 0, right: 40, bottom: 10, left: 20 }}>
                        <YAxis height={0} />
                        <XAxis dataKey="date" hide />
                        {mainBrush}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        );
    }

    CustomizedDot = (props) => {
        const {
            cx, cy, stroke, payload, value,
        } = props;

        let dotRadius = props.size;

        // debug pivots
        if (this.state.pivots && this.state.pivots.includes(payload["date"]) || payload["pivots"]) {
            return (
                <circle cx={cx} cy={cy} r={dotRadius} stroke="black" strokeWidth={0} fill="blue" />
            );
        }

        // if is a buy date
        if (this.state.buyDates.has(payload["date"])) {
            let color = "green";
            // make circle larger if selected this event
            if (this.props.eventIndex >= 0 && payload["date"] == this.props.results["events"][this.props.eventIndex]["buyDate"]) {
                return <rect x={cx - dotRadius} y={cy - dotRadius} width={dotRadius * 2} height={dotRadius * 2} stroke="black" strokeWidth={0} fill={color} />;
            }
            return (
                <circle cx={cx} cy={cy} r={dotRadius} stroke="black" strokeWidth={0} fill="green" />
            );
        }
        // if is a sell date
        else if (this.state.sellDates.has(payload["date"])) {
            let color = "red";
            // make circle larger if selected this event
            if (this.props.eventIndex >= 0 && payload["date"] == this.props.results["events"][this.props.eventIndex]["sellDate"]) {
                return <rect x={cx - dotRadius} y={cy - dotRadius} width={dotRadius * 2} height={dotRadius * 2} stroke="black" strokeWidth={0} fill={color} />;
            }
            return (
                <circle cx={cx} cy={cy} r={dotRadius} stroke="black" strokeWidth={0} fill={color} />
            );
        }
        // if holding
        else if (this.state.holdings.hasOwnProperty(payload["date"])) {
            return <circle cx={cx} cy={cy} r={dotRadius} stroke="black" strokeWidth={0} fill="yellow" />
        }

        return (
            <div></div>
        );
    };
}

let mapStateToProps = (state) => {
    console.log("new props in chart");
    return {
        symbol: state.selectedSymbol, results: state.backtestResults["symbolData"][state.selectedSymbol],
        activeIndicators: [...state.activeIndicators], indicatorOptions: state.indicatorOptions, strategyOptions: state.backtestResults["strategyOptions"],
        eventIndex: state.eventIndex, chartSettings: state.chartSettings
    }
};

export default connect(mapStateToProps, null)(Chart);
