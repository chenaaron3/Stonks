import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, ReferenceLine,
    Tooltip, CartesianGrid, Brush, ErrorBar, AreaChart, Area, DotProps
} from 'recharts';
import distinctColors from 'distinct-colors'
import './Chart.css';
import RSI from './indicators/RSI';
import MACD from './indicators/MACD';
import ADX from './indicators/ADX';
import Stochastic from './indicators/Stochastic';
import Volume from './indicators/Volume';
import Loading from './Loading';
import { formatDate, numberWithCommas, displayDelta, daysBetween } from '../helpers/utils';
import { getEndpoint, postEndpoint } from '../helpers/api';

import Backtest from '../types/backtest';
import Indicator from '../types/indicator';
import API from '../types/api';
import { PivotsData, StockData } from '../types/common';
import { IndicatorGraphNames, IndicatorGraphsData, IndicatorGraphData, IndicatorGraphEntry } from '../types/types';

interface HoldingsData {
    [key: string]: Backtest.HoldingData;
}

interface EventsLookupData {
    [key: string]: {
        type: 'buy' | 'sell';
        event: Backtest.EventData
    }
}

interface StoplossTargetsData {
    [key: string]: {
        stoploss?: number;
        stoplossPercent?: number;
        target?: number;
        targetPercent?: number;
    }
}

type VolumeGraphData = VolumeGraphEntry[];
interface VolumeGraphEntry {
    date: string;
    values: {
        volume: number;
    }
}

type PriceGraphData = PriceGraphEntry[];
interface PriceGraphEntry {
    date: string;
    price: number;
    redCandleBody?: number[];
    greenCandleBody?: number[];
    candleWick: number[];
    stoploss: number[];
    target: number[];
    actual: number[]; // price on alpaca
    overlays: {
        [key: string]: number;
    }
}

// Global variables
let graphs: API.Symbol._PostPriceGraph = null!;
let dates: string[] = [];

const Chart = () => {
    // constants
    const indicatorCharts = { 'RSI': RSI, 'MACD': MACD, 'ADX': ADX, 'Stochastic': Stochastic };
    const overlayCharts = ['SMA', 'GC', 'EMA', 'Structure', 'Pullback', 'Breakout', 'ATR', 'Swing', 'Divergence', 'Trend', 'Candle', 'High'];
    const chunkSize = 500;
    const scrollThreshold = .025;
    const eventMargin = .1;

    // chunks
    const minThreshold = Math.floor(chunkSize * scrollThreshold);
    const maxThreshold = Math.floor(chunkSize * (1 - scrollThreshold));

    const symbol = useAppSelector(state => state.backtest.selectedSymbol);
    const results = useAppSelector(state => state.backtest.results.symbolData[state.backtest.selectedSymbol]);
    const activeIndicators = useAppSelector(state => state.indicator.actives);
    const indicatorOptions = useAppSelector(state => state.indicator.options);
    const strategyOptions = useAppSelector(state => state.backtest.results.strategyOptions);
    const eventIndex = useAppSelector(state => state.backtest.selectedEvent);
    const chartSettings = useAppSelector(state => state.user.chartSettings);
    const closedOrders = useAppSelector(state => state.user.closedOrders[state.backtest.selectedSymbol]);

    const [priceGraph, setPriceGraph] = useState<PriceGraphData>([]);
    const [indicatorGraphs, setIndicatorGraphs] = useState<IndicatorGraphsData>({});
    const [volumeGraph, setVolumeGraph] = useState<VolumeGraphData>([]);
    const [pivots, setPivots] = useState<PivotsData>({});
    const [startIndex, setStartIndex] = useState(-1);
    const [startBrushIndex, setStartBrushIndex] = useState(chunkSize - Math.floor(chunkSize / 4));
    const [endBrushIndex, setEndBrushIndex] = useState(chunkSize - 1);
    const [supportLevels, setSupportLevels] = useState([]);
    const [resistanceLevels, setResistanceLevels] = useState([]);
    const [supportResistanceLevels, setSupportResistanceLevels] = useState([]);
    const [buyDates, setBuyDates] = useState<Set<string>>(new Set());
    const [sellDates, setSellDates] = useState<Set<string>>(new Set());
    const [holdings, setHoldings] = useState<HoldingsData>({});
    const [eventsLookup, setEventsLookup] = useState<EventsLookupData>({}); // map a buy/sell date to its event 
    const [stoplossTarget, setStoplossTarget] = useState<StoplossTargetsData>({}); // map a buy date to its stoploss/target 
    const [myOverlayCharts, setMyOverlayCharts] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    let newSymbol = false;
    let newIndicators = false;
    useEffect(() => {
        // if symbol, indicator, or event index changed
        if (symbol != '') {
            console.log('NEW SYMBOL!');
            newSymbol = true;
            // track buy/sell events
            updateBuySellEvents();
            // fetch graph data
            fetchData();
        }
    }, [symbol])

    useEffect(() => {
        if (symbol != '' && !newSymbol) {
            console.log('NEW INDICATORS!');
            newIndicators = true;
            fetchData();
        }
    }, [activeIndicators])

    useEffect(() => {
        if (symbol != '' && !newSymbol && dates.length > 0 && startIndex > -1) {
            console.log('NEW EVENT!');
            goToEvent();
        }
    }, [eventIndex])

    useEffect(() => {
        if (symbol != '' && dates.length > 0 && startIndex > -1) {
            loadChunk();
        }
    }, [startIndex])

    const updateBuySellEvents = () => {
        console.log('Processing events...');
        let events = results['events'];

        // cache holdings by buy date
        let holdings: HoldingsData = {};
        results['holdings'].forEach(holding => {
            holdings[holding['buyDate']] = holding;
        })

        // cache all buy/sell dates for quick access
        let buyDates = new Set<string>();
        let sellDates = new Set<string>();
        let eventsLookup: EventsLookupData = {};
        events.forEach(event => {
            buyDates.add(event['buyDate']);
            sellDates.add(event['sellDate']);
            eventsLookup[event['buyDate']] = { type: 'buy', event: event };
            eventsLookup[event['sellDate']] = { type: 'sell', event: event };
        });

        // update state
        setBuyDates(buyDates);
        setSellDates(sellDates);
        setEventsLookup(eventsLookup);
        setStoplossTarget({});
        setHoldings(holdings);
    }

    const fetchData = async () => {
        let finalOptions: any = {};
        activeIndicators.forEach(activeIndicator => {
            finalOptions[activeIndicator] = indicatorOptions[activeIndicator];
        });
        let graphData = { symbol: symbol, indicators: finalOptions, timeframe: strategyOptions['timeframe'] };

        postEndpoint<API.Symbol.PostPriceGraph, API.Symbol._PostPriceGraph>('symbol/priceGraph', graphData)
            .then(async res => {
                // save graphs to load chunks later
                graphs = res;
                setPivots(res['pivots']);
                console.log('Received data from server');

                let myOverlayCharts: string[] = [];
                let indicatorGraphs = graphs['indicators'];

                // initialize indicator graphs
                Object.keys(indicatorGraphs).forEach(indicatorName => {
                    // overlays store data with symbol price
                    if (overlayCharts.includes(indicatorName)) {
                        let graphNames = Object.keys(indicatorGraphs[indicatorName]);
                        myOverlayCharts = myOverlayCharts.concat(graphNames);
                    }
                });
                setMyOverlayCharts(myOverlayCharts);

                // refresh dates if new symbol
                if (newSymbol) {
                    // cache sorted date array for finding events
                    dates = [];
                    graphs['price'].forEach(day => {
                        dates.push(new Date(day['date']).toISOString());
                    });
                }
                // no brush movement, but want to reload chunk
                if (newIndicators) {
                    loadChunk();
                }

                // if want to view start
                if (eventIndex == -1) {
                    console.log('Viewing latest data');

                    // set brush range
                    // if large enough to be chunked
                    if (graphs['price'].length > chunkSize) {
                        // set brush to end
                        setStartBrushIndex(chunkSize - Math.floor(chunkSize / 4));
                        setEndBrushIndex(chunkSize - 1);
                        // load most recent chunk
                        setStartIndex(graphs['price'].length - chunkSize);
                    }
                    else {
                        // set brush to cover half of everything
                        setStartBrushIndex(Math.floor(graphs['price'].length / 2));
                        setEndBrushIndex(graphs['price'].length - 1);
                        // load entire everything as 1 chunk
                        setStartIndex(0);
                    }
                }
                else {
                    goToEvent();
                }
            })
    }

    const goToEvent = async () => {
        console.log(`Going to event ${eventIndex}...`);
        // new stock, dont move brush
        if (eventIndex == -1) {
            loadChunk();
            return;
        }
        let events = results['events'];
        // get event info
        let event = events[eventIndex];
        let buyDateIndex = dates.indexOf(event['buyDate']);
        let sellDateIndex = dates.indexOf(event['sellDate']);

        // left/right margin from buy and sells
        let brushMarginSize;
        let max = 0;
        let min = 0;
        let startIndex = 0;

        // set full view
        // If chunkable
        if (graphs['price'].length > chunkSize) {
            // place event in the center of the chunk
            let chunkMarginSize = Math.floor((chunkSize - (sellDateIndex - buyDateIndex)) / 2);
            startIndex = Math.max(0, buyDateIndex - chunkMarginSize);
            // max/min at ends of chunk
            max = maxThreshold;
            min = minThreshold;
            // base margin on chunk size
            brushMarginSize = Math.floor(chunkSize * eventMargin)
        }
        // View entire chunk
        else {
            startIndex = 0;
            // max/min at ends of price
            max = graphs['price'].length - 1;
            min = 0;
            // base margin on price size
            brushMarginSize = Math.floor(graphs['price'].length * eventMargin)
        }

        // set brush view
        let startBrushIndex;
        let endBrushIndex;
        if (chartSettings['Test Mode']) {
            // place buy at the end
            startBrushIndex = Math.max(min, buyDateIndex - startIndex - brushMarginSize);
            endBrushIndex = Math.min(max, buyDateIndex - startIndex);
        }
        else {
            // place brush around buy/sell events
            startBrushIndex = Math.max(min, buyDateIndex - startIndex - brushMarginSize);
            endBrushIndex = Math.min(max, sellDateIndex - startIndex + brushMarginSize);
        }
        if (dates.length - startIndex < chunkSize) {
            endBrushIndex = Math.min(endBrushIndex, dates.length - startIndex - 2);
        }
        setStartBrushIndex(startBrushIndex);
        setEndBrushIndex(endBrushIndex);
        setStartIndex(startIndex);
    }

    const loadChunk = () => {
        console.log(`Loading chunk ${startIndex}/${dates.length}...`)
        let priceGraph: PriceGraphData = [];
        let volumeGraph: VolumeGraphData = [];
        let myIndicatorGraphs: { [key: string]: IndicatorGraphData } = {};
        let indicatorGraphs = graphs['indicators'];

        // initialize indicator graphs
        Object.keys(indicatorGraphs).forEach(indicatorName => {
            // non-overlays have their own lists in state
            if (!overlayCharts.includes(indicatorName)) {
                myIndicatorGraphs[indicatorName] = [];
            }
        });

        // only load a certain chunk for better performance
        let days = graphs['price'];
        days = days.slice(startIndex, startIndex + chunkSize);

        console.log('Loading chunks for', Object.keys(indicatorGraphs));

        // fill in graphs
        days.forEach(day => {
            // for price
            let date = day['date'].toString();
            let close = day['close'];
            let open = day['open'];
            let low = day['low'];
            let high = day['high'];
            // candles
            let greenCandleBody = close >= open ? [close - open, 0] : undefined;
            let redCandleBody = close < open ? [0, open - close] : undefined;
            let candleWick = [close - low, high - close];
            // stoploss/target
            let atr = graphs['atr']['ATR'];
            let stoploss = getStoploss(date, atr, close, low);
            let target = getTarget(date, atr, close, low);
            let actual = getActual(date, close);
            let priceEntry: PriceGraphEntry = {
                date, price: close, redCandleBody, greenCandleBody, candleWick,
                stoploss: stoploss!, target: target!, actual: actual!, overlays: {}
            };

            // for indicators
            Object.keys(indicatorGraphs).forEach(indicatorName => {
                // overlays store data with symbol price
                if (overlayCharts.includes(indicatorName)) {
                    let graphNames = Object.keys(indicatorGraphs[indicatorName]);
                    graphNames.forEach(graphName => {
                        priceEntry['overlays'][graphName] = indicatorGraphs[indicatorName][graphName][date];
                    })
                }
                // non-overlays have their own lists
                else {
                    let entry: IndicatorGraphEntry = { date, values: {} };
                    // each indicator may have multiple graphs
                    let graphNames = Object.keys(indicatorGraphs[indicatorName]);
                    graphNames.forEach(graphName => {
                        entry['values'][graphName] = indicatorGraphs[indicatorName][graphName][date];
                    })
                    myIndicatorGraphs[indicatorName].push(entry)
                }
            });

            priceGraph.push(priceEntry);
            volumeGraph.push({ date, values: { volume: graphs['volumes'][date] } });
        });

        setIndicatorGraphs(myIndicatorGraphs);
        setPriceGraph(priceGraph);
        setVolumeGraph(volumeGraph);
        setLoading(false);
    }

    const onBrushChange = (newRange: { startIndex: number; endIndex: number; }) => {
        let newStart = newRange['startIndex'];
        let newEnd = newRange['endIndex'];
        // entered previous area
        if (newStart < minThreshold && startIndex > 0) {
            // move left by 25% of the chunk
            let oldStart = startIndex;
            let newStartIndex = Math.floor(Math.max(0, startIndex - chunkSize * .25));

            // adjust the brush
            let shiftAmount = oldStart - newStartIndex;
            let startBrushIndex = Math.max(minThreshold, newStart + shiftAmount);
            let endBrushIndex = Math.min(maxThreshold, newEnd + shiftAmount);
            setStartBrushIndex(startBrushIndex);
            setEndBrushIndex(endBrushIndex);
            setStartIndex(newStartIndex);
        }
        // entered next area and not already at the end
        else if (newEnd > maxThreshold && startIndex < graphs['price'].length - chunkSize) {
            // move right by 25% of the chunk
            let oldStart = startIndex;
            let newStartIndex = Math.floor(Math.min(graphs['price'].length - chunkSize, startIndex + chunkSize * .25));

            // adjust the brush
            let shiftAmount = newStartIndex - oldStart;
            let startBrushIndex = Math.max(minThreshold, newStart - shiftAmount);
            let endBrushIndex = Math.min(maxThreshold, newEnd - shiftAmount);
            setStartBrushIndex(startBrushIndex);
            setEndBrushIndex(endBrushIndex);
            setStartIndex(newStartIndex);
        }
    }

    const xAxisTickFormatter = (value: string) => {
        return formatDate(new Date(value));
    }

    const labelFormatter = (label: string) => {
        if (!label) {
            return <></>
        }
        let stoploss = undefined;
        let target = undefined;
        let profit = undefined;
        // show stoploss/target on buy events
        if (stoplossTarget[label]) {
            stoploss = stoplossTarget[label]['stoploss'];
            target = stoplossTarget[label]['target'];
        }
        // show profit on sell events
        if (eventsLookup.hasOwnProperty(label) && eventsLookup[label]['type'] == 'sell') {
            profit = eventsLookup[label]['event']['profit'];
        }
        return <>
            {formatDate(label)}
            <br />
            {target ? (<>{`🎯: $${target.toFixed(2)} (${stoplossTarget[label]['targetPercent']!.toFixed(2)}%)`}<br /></>) : ''}
            {stoploss ? (<>{`🛑: $${stoploss.toFixed(2)} (${stoplossTarget[label]['stoplossPercent']!.toFixed(2)}%)`}<br /></>) : ''}
            {profit ? (<>{`💸: $${profit.toFixed(2)} (${displayDelta(eventsLookup[label]['event']['percentProfit'] * 100)}%)`}<br /></>) : ''}
        </>
    }

    const tooltipFormatter = (value: Object | number, name: string) => {
        if (name == 'price') {
            return [(value as number).toFixed(4), symbol];
        }
        let newName = name;
        if (name.startsWith('overlays.')) {
            newName = name.substring(9);
        }
        else if (name.startsWith('values.')) {
            newName = name.substring(7);
        }
        if (value) {
            try {
                return [(value as number).toFixed(4), newName];
            }
            catch {
                if (typeof value == 'object') {
                    return '';
                }
                return [value, newName];
            }
        }
    }

    const brushFormatter = (value: string) => {
        return formatDate(value);
    }

    const getStoploss = (date: string, atr: StockData, close: number, low: number) => {
        let stoploss = undefined;
        // for buy events
        if (eventsLookup[date] && eventsLookup[date]['type'] == 'buy') {
            let event = eventsLookup[date]['event'];
            if (event['risk']) {
                stoploss = close * (100 - event['risk']) / 100;
            }
        }

        // for holdings
        if (holdings.hasOwnProperty(date)) {
            let holding = holdings[date];
            if (holding['stoplossTarget']) {
                stoploss = holding['stoplossTarget']['initStoploss'];
            }
            else {
                return undefined;
            }
        }

        if (stoploss) {
            // cache stoploss
            if (!stoplossTarget.hasOwnProperty(date)) {
                stoplossTarget[date] = {};
            }
            stoplossTarget[date]['stoploss'] = stoploss;
            stoplossTarget[date]['stoplossPercent'] = (close - stoploss) / close * 100;
            // return error bar format
            return [close - stoploss, 0];
        }
    }

    const getTarget = (date: string, atr: StockData, close: number, low: number) => {
        // only show for buy dates and holdings
        if (!buyDates.has(date) && !holdings.hasOwnProperty(date)) {
            return undefined;
        }

        let target = undefined;
        if (strategyOptions['riskRewardRatio']) {
            let stopLoss = low - strategyOptions['stopLossAtr']! * atr[date];
            // for buy events
            if (eventsLookup[date] && eventsLookup[date]['type'] == 'buy') {
                let event = eventsLookup[date]['event'];
                if (event['risk']) {
                    stopLoss = close * (100 - event['risk']) / 100;
                }
            }

            // for holdings
            if (holdings.hasOwnProperty(date)) {
                let holding = holdings[date];
                stopLoss = holding['stoplossTarget']['initStoploss']!;
            }

            target = close + strategyOptions['riskRewardRatio'] * (close - stopLoss);
        }

        if (target) {
            // cache target
            if (!stoplossTarget.hasOwnProperty(date)) {
                stoplossTarget[date] = {};
            }
            stoplossTarget[date]['target'] = target;
            stoplossTarget[date]['targetPercent'] = (target - close) / close * 100;
            // return error bar format
            return [0, target - close];
        }
    }

    const getActual = (date: string, close: number) => {
        // only show for buy/sell dates and holdings
        if (!buyDates.has(date) && !sellDates.has(date) && !holdings.hasOwnProperty(date)) {
            return undefined;
        }

        // no closed orders for this symbol
        if (!closedOrders) {
            return undefined;
        }

        let closedOrder = undefined;
        let isBuy = buyDates.has(date) || holdings.hasOwnProperty(date);
        // find the corresponding closed order to this date 
        if (closedOrders) {
            closedOrder = closedOrders.find(closedOrder => {
                let referenceDate = isBuy ? closedOrder['buyDate'] : closedOrder['sellDate'];
                return referenceDate && daysBetween(new Date(referenceDate), new Date(date)) <= 1;
            })
        }
        if (closedOrder) {
            let actualPrice = isBuy ? closedOrder['buyPrice'] : closedOrder['sellPrice'];
            if (actualPrice! > close) {
                return [0, actualPrice! - close];
            }
            else {
                return [close - actualPrice!, 0];
            }
        }

        return undefined;
    }

    const getSupportResistance = () => {
        // TODO: use pivots
        return new Promise((resolve, reject) => {
        })
    }

    interface CustomizedDotData extends DotProps {
        size: number;
        payload?: PriceGraphEntry;
    }

    const CustomizedDot: React.FC<CustomizedDotData> = (props) => {
        const {
            cx, cy, stroke, payload,
        } = props;

        let dotRadius = props.size;

        if (payload) {
            // debug pivots
            if (pivots && pivots.hasOwnProperty(payload['date'])) {
                return (
                    <circle cx={cx} cy={cy} r={dotRadius} stroke='black' strokeWidth={0} fill='blue' />
                );
            }

            // if is a buy date
            if (buyDates.has(payload['date'])) {
                let color = 'green';
                // make circle larger if selected this event
                if (eventIndex >= 0 && payload['date'] == results['events'][eventIndex]['buyDate']) {
                    return <rect x={cx! - dotRadius} y={cy! - dotRadius} width={dotRadius * 2} height={dotRadius * 2} stroke='black' strokeWidth={0} fill={color} />;
                }
                return (
                    <circle cx={cx} cy={cy} r={dotRadius} stroke='black' strokeWidth={0} fill='green' />
                );
            }
            // if is a sell date
            else if (sellDates.has(payload['date'])) {
                let color = 'red';
                // make circle larger if selected this event
                if (eventIndex >= 0 && payload['date'] == results['events'][eventIndex]['sellDate']) {
                    return <rect x={cx! - dotRadius} y={cy! - dotRadius} width={dotRadius * 2} height={dotRadius * 2} stroke='black' strokeWidth={0} fill={color} />;
                }
                return (
                    <circle cx={cx} cy={cy} r={dotRadius} stroke='black' strokeWidth={0} fill={color} />
                );
            }
            // if holding
            else if (holdings.hasOwnProperty(payload['date'])) {
                return <circle cx={cx} cy={cy} r={dotRadius} stroke='black' strokeWidth={0} fill='yellow' />
            }
        }

        return (
            <div></div>
        );
    };

    if (loading) {
        return <>
            <Loading loading={loading} />
        </>
    }
    // if no symbol, return
    if (!symbol) {
        return <span className='chart-missing'>Run a Strategy!</span>
    }
    let margins = { top: 20, right: 40, bottom: 20, left: 20 };
    let sideChartHeight = 15;
    let mainChartHeight = 100 - (activeIndicators.filter(i => !overlayCharts.includes(i)).length + 2) * sideChartHeight; // + 2 (scroll, volume)

    // Brushes
    let mainBrush = <Brush gap={1} height={65} dataKey='date' startIndex={startBrushIndex} endIndex={endBrushIndex}
        onChange={onBrushChange as any} tickFormatter={brushFormatter} >
        <AreaChart>
            <CartesianGrid horizontal={false} />
            <YAxis hide domain={['auto', 'auto']} />
            <Area dataKey='price' stroke='#ff7300' fill='#ff7300' dot={<CustomizedDot size={3} />} />
        </AreaChart>
    </Brush>;
    let hiddenBrush = <Brush gap={1} width={0} height={0.00001} dataKey='date' startIndex={startBrushIndex} endIndex={endBrushIndex} />;
    let simpleTooltip = <Tooltip
        wrapperStyle={{
            borderColor: 'white',
            boxShadow: '2px 2px 3px 0px rgb(204, 204, 204)',
        }}
        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
        labelStyle={{ fontWeight: 'bold', color: '#666666' }}
        formatter={tooltipFormatter}
        labelFormatter={(label) => formatDate(label)}
    />;
    let tooltip = <Tooltip
        wrapperStyle={{
            borderColor: 'white',
            boxShadow: '2px 2px 3px 0px rgb(204, 204, 204)',
        }}
        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
        labelStyle={{ fontWeight: 'bold', color: '#666666' }}
        formatter={tooltipFormatter}
        labelFormatter={labelFormatter}
    />;

    // Main Line
    let mainLine = <Line dataKey='price' stroke='#ff7300' dot={<CustomizedDot size={10} />}>
        <ErrorBar dataKey='greenCandleBody' width={0} strokeWidth={5} stroke='green' direction='y' />
        <ErrorBar dataKey='redCandleBody' width={0} strokeWidth={5} stroke='red' direction='y' />
        <ErrorBar dataKey='candleWick' width={1} strokeWidth={1} stroke='black' direction='y' />
        <ErrorBar dataKey='stoploss' width={15} strokeWidth={1} stroke='red' direction='y' />
        <ErrorBar dataKey='target' width={15} strokeWidth={1} stroke='green' direction='y' />
        <ErrorBar dataKey='actual' width={15} strokeWidth={1} stroke='black' direction='y' />
    </Line>;
    if (!chartSettings['Candles']) {
        mainLine = <Line dataKey='price' stroke='#ff7300' dot={<CustomizedDot size={10} />}>
            <ErrorBar dataKey='stoploss' width={15} strokeWidth={1} stroke='red' direction='y' />
            <ErrorBar dataKey='target' width={15} strokeWidth={1} stroke='green' direction='y' />
            <ErrorBar dataKey='actual' width={15} strokeWidth={1} stroke='black' direction='y' />
        </Line>;
    }

    // Support Resistance Lines
    let supportResistanceLines = supportResistanceLevels.map(sr => <ReferenceLine y={sr['price']} stroke='black' strokeDasharray='3 3' />);
    if (!chartSettings['Support Lines']) {
        supportResistanceLines = [<div key='empty'></div>];
    }

    return (
        <div className='chart-container'>
            {/* Main Chart */}
            <ResponsiveContainer width='100%' height={`${mainChartHeight}%`}>
                <LineChart data={priceGraph} syncId='graph' margin={margins}>
                    <CartesianGrid vertical={false} horizontal={false} />
                    <XAxis dataKey='date' minTickGap={50} height={25} tickFormatter={xAxisTickFormatter} />
                    <YAxis domain={['auto', 'auto']} orientation='left' />
                    {/* Main Line */}
                    {mainLine}
                    {/* Overlay Charts */}
                    {
                        myOverlayCharts.length > 0 && myOverlayCharts.map((overlay, index) => {
                            let colors = distinctColors({ count: myOverlayCharts.length, lightMin: 50 });
                            return <Line key={overlay} dataKey={`overlays.${overlay}`} strokeWidth={3} stroke={`${colors[index].hex()}`} dot={false} />
                        })
                    }
                    {/* Support and Resistance Lines */}
                    {supportResistanceLines}
                    {/* {
                            this.state.supportLevels.map(support => <ReferenceLine y={support} stroke='green' strokeDasharray='3 3' />)
                        }
                        {
                            this.state.resistanceLevels.map(resistance => <ReferenceLine y={resistance} stroke='red' strokeDasharray='3 3' />)
                        } */}
                    {hiddenBrush}
                    {tooltip}
                </LineChart>
            </ResponsiveContainer>
            <ResponsiveContainer width='100%' height={`${sideChartHeight}%`} key={`volume-chart`} >
                <Volume graph={volumeGraph} xAxisTickFormatter={xAxisTickFormatter} brush={hiddenBrush} tooltip={simpleTooltip} />
            </ResponsiveContainer>
            {/* Sub Charts */}
            {
                activeIndicators.map((indicatorName, index) => {
                    if (overlayCharts.includes(indicatorName)) {
                        return;
                    }
                    let ChartClass = indicatorCharts[indicatorName as IndicatorGraphNames];
                    let chart = <ChartClass graph={indicatorGraphs[indicatorName as IndicatorGraphNames]!} xAxisTickFormatter={xAxisTickFormatter}
                        options={indicatorOptions[indicatorName]} brush={hiddenBrush} tooltip={simpleTooltip} />

                    return <ResponsiveContainer width='100%' height={`${sideChartHeight}%`} key={`${symbol}-chart-${index}`} >
                        {chart}
                    </ResponsiveContainer>
                })
            }
            {/* Main Brush */}
            <ResponsiveContainer width='100%' height={75}>
                <LineChart data={priceGraph} syncId='graph' margin={{ top: 0, right: 40, bottom: 10, left: 20 }}>
                    <YAxis height={0} />
                    <XAxis dataKey='date' hide />
                    {mainBrush}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

export default Chart;
