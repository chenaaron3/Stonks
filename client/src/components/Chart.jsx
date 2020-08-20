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
import { formatDate } from '../helpers/utils';

class Chart extends React.Component {
    constructor(props) {
        super(props);

        // constants
        this.indicatorCharts = { "RSI": RSI, "MACD": MACD };
        this.overlayCharts = ["SMA", "GC"];
        this.chunkSize = 500;
        this.scrollThreshold = .025;
        this.eventMargin = .1;

        // start of chunk
        this.startIndex = 0;
        this.minThreshold = Math.floor(this.chunkSize * this.scrollThreshold);
        this.maxThreshold = Math.floor(this.chunkSize * (1 - this.scrollThreshold));

        this.state = {
            priceGraph: [],
            buyDates: new Set(),
            sellDates: new Set(),
            myOverlayCharts: [],
            startBrushIndex: this.chunkSize - Math.floor(this.chunkSize / 4),
            endBrushIndex: this.chunkSize - 1
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
        events.forEach(event => {
            buyDates.add(event["buyDate"]);
            sellDates.add(event["sellDate"]);
        });
        this.setState({ buyDates, sellDates });
    }

    fetchData = () => {
        let finalOptions = {};
        this.props.activeIndicators.forEach(activeIndicator => {
            finalOptions[activeIndicator] = this.props.indicatorOptions[activeIndicator];
        });
        let graphData = { symbol: this.props.symbol, indicators: finalOptions };

        fetch(`${process.env.REACT_APP_SUBDIRECTORY}/priceGraph`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(graphData)
        })
            .then(res => res.json())
            .then(graphs => {
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
                    this.loadChunk();
                }
                // if updating indicators
                else {
                    // go back to the event user was looking at
                    this.goToEvent();
                }
            })
    }

    goToEvent = () => {
        if (this.props.eventIndex == -1) {
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

        // If chunkable
        if (this.graphs["price"].length > this.chunkSize) {
            // place event in the center of the chunk
            let chunkMarginSize = Math.floor((this.chunkSize - (sellDateIndex - buyDateIndex)) / 2);
            this.startIndex = buyDateIndex - chunkMarginSize;
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
        this.loadChunk();

        let startBrushIndex = Math.max(min, buyDateIndex - this.startIndex - brushMarginSize);
        let endBrushIndex = Math.min(max, sellDateIndex - this.startIndex + brushMarginSize);
        this.setState({ startBrushIndex, endBrushIndex });
    }

    xAxisTickFormatter = (value) => {
        return getFormattedDate(new Date(value));
    }

    tooltipFormatter = (value, name, props) => {
        if (name == "price") {
            return [value.toFixed(4), this.props.symbol];
        }
        return value.toFixed(4);
    }

    brushFormatter = (value) => {
        return getFormattedDate(value);
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

        // fill in graphs
        days.forEach(day => {
            // for price
            let date = day["date"];
            let price = day["adjClose"];
            let priceEntry = { date, price };

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
        this.setState({ priceGraph });
    }

    wheelHandler = (e) => {
        // scroll up/zoom in
        if (e.deltaY < 0) {
        }
        // scroll down/zoom out
        else {
        }
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

        let mainBrush = <Brush gap={1} height={65} dataKey="date" startIndex={this.state.startBrushIndex} endIndex={this.state.endBrushIndex} onChange={this.onBrushChange} tickFormatter={this.brushFormatter}>
            <AreaChart>
                <CartesianGrid horizontal={false} />
                <YAxis hide domain={['auto', 'auto']} />
                <Area dataKey="price" stroke="#ff7300" fill="#ff7300" dot={<this.CustomizedDot size={3} />} />
            </AreaChart>
        </Brush>;
        let hiddenBrush = <Brush gap={1} width={0} height={0.00001} dataKey="date" startIndex={this.state.startBrushIndex} endIndex={this.state.endBrushIndex} />;
        let tooltip = <Tooltip
            wrapperStyle={{
                borderColor: 'white',
                boxShadow: '2px 2px 3px 0px rgb(204, 204, 204)',
            }}
            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
            labelStyle={{ fontWeight: 'bold', color: '#666666' }}
            formatter={this.tooltipFormatter}
            labelFormatter={label => getFormattedDate(label)}
        />;

        return (
            <div className="chart-container" onWheel={this.wheelHandler}>
                {/* Main Chart */}
                <ResponsiveContainer width="100%" height={`${mainChartHeight}%`}>
                    <LineChart data={this.state.priceGraph} syncId="graph" margin={margins}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="date" minTickGap={50} height={25} tickFormatter={this.xAxisTickFormatter} />
                        <YAxis domain={["auto", "auto"]} orientation="left" />
                        {/* Overlay Charts */}
                        <Line dataKey="price" stroke="#ff7300" dot={<this.CustomizedDot size={10} />} />
                        {
                            this.state.myOverlayCharts.length > 0 && this.state.myOverlayCharts.map((overlay, index) => {
                                let colors = distinctColors({ count: this.state.myOverlayCharts.length, lightMin: 50 });
                                return <Line key={overlay} dataKey={overlay} strokeWidth={3} stroke={`${colors[index].hex()}`} dot={false} />
                            })
                        }
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
                            options={this.props.indicatorOptions[indicatorName]} brush={hiddenBrush} tooltip={tooltip} />

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

        // if is a buy date
        if (this.state.buyDates.has(payload["date"])) {
            return (
                <circle cx={cx} cy={cy} r={dotRadius} stroke="black" strokeWidth={0} fill="green" />
            );
        }
        // if is a sell date
        else if (this.state.sellDates.has(payload["date"])) {
            return (
                <circle cx={cx} cy={cy} r={dotRadius} stroke="black" strokeWidth={0} fill="red" />
            );
        }
        else if (this.props.results["recent"]["buy"].includes(payload["date"])) {
            return <circle cx={cx} cy={cy} r={dotRadius} stroke="black" strokeWidth={0} fill="yellow" />
        }

        return (
            <div></div>
        );
    };
}

function getFormattedDate(date) {
    if (typeof date == "string") {
        date = new Date(date);
    }
    var year = date.getFullYear();

    var month = (1 + date.getMonth()).toString();
    month = month.length > 1 ? month : '0' + month;

    var day = date.getDate().toString();
    day = day.length > 1 ? day : '0' + day;

    return month + '/' + day + '/' + year % 100;
}

let mapStateToProps = (state) => {
    console.log("new props in chart");
    return {
        symbol: state.selectedSymbol, results: state.backtestResults["symbolData"][state.selectedSymbol],
        activeIndicators: [...state.activeIndicators], indicatorOptions: state.indicatorOptions,
        eventIndex: state.eventIndex
    }
};

export default connect(mapStateToProps, null)(Chart);
