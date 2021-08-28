import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { setBacktestResults } from '../redux/slices/backtestSlice';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import './Dashboard.css';
import {
    Tooltip, Label, ResponsiveContainer,
    PieChart, Pie, Cell,
    RadialBarChart, RadialBar,
    LineChart, CartesianGrid, XAxis, YAxis, Line,
    Bar, BarChart, Legend,
    AreaChart, Area
} from 'recharts';
import { numberWithCommas, hoursBetween, daysBetween, camelToDisplay } from '../helpers/utils'

import Button from '@material-ui/core/Button';
import LinearProgress from '@material-ui/core/LinearProgress';
import Box from '@material-ui/core/Box';
import Pusher from 'react-pusher';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import FormControl from '@material-ui/core/FormControl';
import TextField from '@material-ui/core/TextField';
import InputLabel from '@material-ui/core/InputLabel';
import Slider from '@material-ui/core/Slider';
import LinkIcon from '@material-ui/icons/Link';
import IconButton from '@material-ui/core/IconButton';
import IconTooltip from '@material-ui/core/Tooltip';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Switch from '@material-ui/core/Switch';
import MediaQuery from 'react-responsive';

import Backtest from '../types/backtest';

import API from '../types/api';

let winLossColor = ['#2ecc71', '#FFCCCB'];

interface PieDataEntry {
    name: string;
    value: number;
}

interface BucketDataEntry {
    key?: string;
    winTrades: number,
    lossTrades: number,
    profit: number
}

type BucketTypes = 'year' | '6 months' | '3 months' | '1 month';

const Dashboard: React.FC = (props) => {
    const dispatch = useAppDispatch();
    const [statistics, setStatistics] = useState({
        numWins: 0, numLosses: 0, winSpan: 0, lossSpan: 0, winAmount: 0, lossAmount: 0, winPercent: 0, lossPercent: 0
    })
    const [chartData, setChartData] = useState<{
        winLossData: PieDataEntry[], spanData: PieDataEntry[], percentProfitData: PieDataEntry[], profitData: PieDataEntry[], bucketData: BucketDataEntry[]
    }>({
        winLossData: [], spanData: [], percentProfitData: [], profitData: [], bucketData: []
    })
    const [updateProgress, setUpdateProgress] = useState(-1);
    const [bucketType, setBucketType] = useState<BucketTypes>('year');
    const [range, setRange] = useState(50);
    const [ctrl, setCtrl] = useState(false);
    const [active, setActive] = useState(false);

    const results = useAppSelector(state => state.backtest.results);
    const id = useAppSelector(state => state.backtest.id);

    // how much time in one bar
    const bucketTypeLookup = { 'year': 12, '6 months': 6, '3 months': 3, '1 month': 1 };
    const bucketTypes = Object.keys(bucketTypeLookup) as BucketTypes[];

    useEffect(() => {
        let timeframe = results['strategyOptions']['timeframe'];

        // if use lower timeframe, view by month category
        if (timeframe && timeframe != '1Day') {
            setBucketType(bucketTypes[3]);
        }

        analyze();
        updateActiveStatus();

        document.addEventListener('keydown', keydownHandler);

        // cleanup on unmount
        return () => {
            document.removeEventListener('keydown', keydownHandler);
        }
    }, []);

    useEffect(() => {
        analyze();
    }, [id, bucketType]);

    // statistical analysis (win/loss)
    const analyze = () => {
        let winSpan = 0;
        let lossSpan = 0;
        let winAmount = 0;
        let lossAmount = 0;
        let winPercent = 0;
        let lossPercent = 0;
        let numWins = 0;
        let numLosses = 0;
        let bucketDataMap: { [key: string]: BucketDataEntry } = {};

        console.log('Analyzing');
        // get the sorted symbols
        let sortedSymbols = Object.keys(results['symbolData']);
        sortedSymbols.sort((a, b) => results['symbolData'][b]['percentProfit'] - results['symbolData'][a]['percentProfit']);

        sortedSymbols.forEach(symbol => {
            results['symbolData'][symbol]['events'].forEach(event => {
                let buyDate = new Date(event['buyDate']);
                // group based on type
                let groupSize = bucketTypeLookup[bucketType];
                let buyMonth = Math.floor(buyDate.getMonth() / groupSize) * groupSize;
                let buyYear = new Date(buyDate.getFullYear(), buyMonth, 1, 0, 0, 0, 0).getTime();
                if (!bucketDataMap.hasOwnProperty(buyYear)) {
                    bucketDataMap[buyYear] = { winTrades: 0, lossTrades: 0, profit: 0 };
                }

                if (Math.abs(event['profit']) > 100000) {
                    return;
                }

                if (event['profit'] < 0) {
                    numLosses += 1;
                    lossSpan += event['span'];
                    lossAmount += event['profit'];
                    lossPercent += event['percentProfit'];
                    bucketDataMap[buyYear]['lossTrades']++;
                }
                else if (event['profit'] > 0) {
                    numWins += 1;
                    winSpan += event['span'];
                    winAmount += event['profit'];
                    winPercent += event['percentProfit'];
                    bucketDataMap[buyYear]['winTrades']++;
                }

                bucketDataMap[buyYear]['profit'] += event['profit'];
            })
        })

        // span adjustments
        winSpan /= numWins;
        winSpan = Math.floor(winSpan);
        lossSpan /= numLosses;
        lossSpan = Math.floor(lossSpan);

        // percent profit adjustments
        winPercent /= numWins;
        winPercent = (100 * winPercent);
        lossPercent /= numLosses;
        lossPercent = (100 * lossPercent);

        let winRate = (numWins) / (numWins + numLosses);
        let annualWinPercentProfit = winPercent * 360 / winSpan * (winRate);
        let annualLossPercentProfit = lossPercent * 360 / lossSpan * (1 - winRate);

        let winLossData = [{
            'name': 'Wins',
            'value': numWins
        },
        {
            'name': 'Losses',
            'value': numLosses
        }];

        let spanData = [{
            'name': 'Win Span',
            'value': winSpan,
        },
        {
            'name': 'Loss Span',
            'value': lossSpan,
        }];

        let percentProfitData = [{
            'name': 'Win % Profit',
            'value': annualWinPercentProfit
        },
        {
            'name': 'Loss % Profit',
            'value': Math.abs(annualLossPercentProfit)
        }]

        let profitData = [{
            'name': 'Win Profit',
            'value': winAmount
        },
        {
            'name': 'Loss Profit',
            'value': Math.abs(lossAmount)
        }]

        let bucketData: BucketDataEntry[] = [];
        let bucketKeys = Object.keys(bucketDataMap);
        bucketKeys.sort((a, b) => {
            return new Date(parseInt(a)).valueOf() - new Date(parseInt(b)).valueOf();
        });
        let profit = 0;
        let currentYear = new Date().getFullYear();
        bucketKeys.forEach(bucketKey => {
            // range cut off
            if (new Date(parseInt(bucketKey)).getFullYear() < currentYear - range) {
                return;
            }
            profit += bucketDataMap[bucketKey]['profit'];
            bucketData.push({ key: bucketKey, ...bucketDataMap[bucketKey], profit });
        })

        setStatistics({
            numWins, numLosses, winSpan, lossSpan, winAmount, lossAmount, winPercent, lossPercent
        })
        setChartData({
            winLossData, spanData, percentProfitData, profitData, bucketData
        })
    }

    // send request to update a backtest
    const updateBacktest = () => {
        setUpdateProgress(0);
        axios.get<{ status: string }>(`${process.env.NODE_ENV == 'production' ? process.env.REACT_APP_SUBDIRECTORY : ''}/updateBacktest?id=${id}`)
            .then(res => alert(res.data['status']))
    }

    // send request to subscribe to auto updates
    const setAutoUpdate = () => {
        axios.post<{ error: string, status: string }>(`${process.env.NODE_ENV == 'production' ? process.env.REACT_APP_SUBDIRECTORY : ''}/autoUpdate`,
            { id: id, subscribe: !active })
            .then(res => {
                let json = res.data;
                if (json['error']) {
                    alert(json['error']);
                }
                else {
                    alert(json['status']);
                    updateActiveStatus();
                }
            })
    }

    const updateActiveStatus = () => {
        // check if is 
        axios.get<API.Index._GetIsAutoUpdate>(`${process.env.NODE_ENV == 'production' ? process.env.REACT_APP_SUBDIRECTORY : ''}/isAutoUpdate?id=${id}`)
            .then(res => {
                let json = res.data;
                setActive(json.found)
            })
    }

    // reload the page when update is complete
    const fetchBacktestResults = (id: string) => {
        axios.get<{ results: Backtest.ResultsData }>(`${process.env.NODE_ENV == 'production' ? process.env.REACT_APP_SUBDIRECTORY : ''}/results?id=${id}`)
            .then(res => {
                dispatch(setBacktestResults(res.data.results));
            })
    }

    const tradeTooltipFormatter = (value: number) => {
        return value.toFixed(4);
    }

    const xAxisTickFormatter = (value: string) => {
        let date = new Date(parseInt(value));
        return formatDate(date);
    }

    const formatDate = (date: Date) => {
        return (date.getMonth() + 1) + '/' + date.getFullYear();
    }

    const handleTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        console.log('changing type to', e.target.value);
        setBucketType(bucketTypes[parseInt(e.target.value)]);
    }

    const onCopyLink = (e: React.MouseEventHandler<HTMLButtonElement>) => {
        navigator.clipboard.writeText(`${process.env.REACT_APP_DOMAIN}${process.env.REACT_APP_SUBDIRECTORY}/` + id);
    }

    const keydownHandler = (e: KeyboardEvent) => {
        if (e.keyCode == 16 || e.keyCode == 17) {
            setCtrl(ctrl);
        }
    }

    let totalTrades = statistics.numWins + statistics.numLosses;
    let winRate = (100 * (statistics.numWins) / (statistics.numWins + statistics.numLosses));
    let avgSpan = Math.floor((statistics.winSpan * statistics.numWins + statistics.lossSpan * statistics.numLosses) / (statistics.numWins + statistics.numLosses));
    let netProfit = (statistics.winAmount + statistics.lossAmount);
    let annualPercentProfit = (statistics.winPercent + statistics.lossPercent).toFixed(0);
    let lastUpdated = new Date(results.lastUpdated);
    let daysBetweenUpdate = daysBetween(lastUpdated, new Date());
    let hoursBetweenUpdate = hoursBetween(lastUpdated, new Date());

    let buyIndicators = JSON.stringify(results.strategyOptions.buyIndicators, null, 2).replace(/[{},']/g, '');
    buyIndicators = buyIndicators.split('\n').filter(x => x.trim().length > 0).join('\n');
    let sellIndicators = JSON.stringify(results.strategyOptions.sellIndicators, null, 2).replace(/[{},']/g, '');
    sellIndicators = sellIndicators.split('\n').filter(x => x.trim().length > 0).join('\n');

    let innerRadius = '70%';
    let outerRadius = '90%';

    return <>
        <Pusher
            channel={id}
            event='onProgressUpdate'
            onUpdate={(data: { progress: number }) => { setUpdateProgress(data.progress) }}
        />
        <Pusher
            channel={id}
            event='onUpdateFinished'
            onUpdate={(data: { id: string }) => {
                fetchBacktestResults(data['id']);
                setUpdateProgress(-1);
            }}
        />
        <div className='dashboard'>
            <div className='dashboard-header'>
                {/* <div> */}
                <span className='dashboard-title'>
                    Backtest Summary
                    <IconTooltip title='Share Link'>
                        <IconButton className='dashboard-link' onClick={this.onCopyLink}>
                            <LinkIcon />
                        </IconButton>
                    </IconTooltip>
                </span>
                <div className='dashboard-settings'>
                    <Box mx='1vw' mt='1vh'>
                        <FormControl style={{ minWidth: '5vw' }}>
                            <InputLabel id='dashboard-chart-range'>Chart Range</InputLabel>
                            <Slider
                                defaultValue={50}
                                aria-labelledby='discrete-slider'
                                valueLabelDisplay='auto'
                                value={this.state.range}
                                onChange={(e, v) => { this.setState({ range: v }, () => { this.analyze() }) }}
                                step={5}
                                marks
                                min={5}
                                max={100}
                            />
                        </FormControl>
                    </Box>
                    <Box width='10vw' display='flex' justifyContent='flex-start'>
                        <FormControl style={{ minWidth: '5vw' }}>
                            <InputLabel id='dashboard-chart-type'>Frequency</InputLabel>
                            <Select
                                value={this.types.indexOf(bucketType)}
                                onChange={this.handleTypeChange}
                            >
                                {
                                    this.types.map((value, index) => {
                                        return <MenuItem key={`dashboard-types-${index}`} value={index}>{value}</MenuItem>
                                    })
                                }
                            </Select>
                        </FormControl>
                    </Box>
                </div>
                {/* </div> */}
                <div className='dashboard-update'>
                    {
                        this.state.ctrl && <>
                            <Box ml='1vw' ><Button variant='contained' color='primary' onClick={this.setAutoUpdate}>
                                {
                                    this.state.active ? 'Manual Update' : 'Auto Update'
                                }
                            </Button></Box>
                        </>
                    }
                    {
                        !this.state.ctrl && <>
                            {
                                this.state.updateProgress < 0 && <span className='dashboard-update-text'>Updated {daysBetweenUpdate > 0 ? `${daysBetweenUpdate} days ago` : `${hoursBetweenUpdate} hours ago`}</span>
                            }
                            {
                                this.state.updateProgress >= 0 && <span className='dashboard-update-text'>Updating</span>
                            }
                            {daysBetweenUpdate > 0 && (
                                <>
                                    {
                                        this.state.updateProgress < 0 && <Box ml='1vw' ><Button variant='contained' color='primary' onClick={this.updateBacktest}>
                                            Update
                                        </Button></Box>
                                    }
                                    {
                                        this.state.updateProgress >= 0 && (
                                            <>
                                                <Box ml='1vw' ><LinearProgress className='dashboard-progress' variant='determinate' value={this.state.updateProgress} /></Box>
                                            </>
                                        )
                                    }
                                </>
                            )}
                        </>
                    }
                    <MediaQuery maxWidth='600px'>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={this.state.ctrl}
                                    onChange={(e) => { this.setState({ ctrl: !this.state.ctrl }) }}
                                    color='primary'
                                />
                            }
                            style={{ minWidth: '5vw' }}
                        />
                    </MediaQuery>
                </div>
            </div>
            <div className='dashboard-body'>
                {/* profit card */}
                <div className='dashboard-card dashboard-pie' id='dashboard-profit-pie'>
                    <h3 className='dashboard-card-title'>Profit</h3>
                    <ResponsiveContainer width='100%' height='80%'>
                        <PieChart className='dashboard-pie'>
                            <Pie data={this.state.profitData} dataKey='value' nameKey='name' cx='50%' cy='50%' innerRadius={innerRadius} outerRadius={outerRadius}>
                                {
                                    this.state.profitData.map((entry, index) => (
                                        <Cell key={`cell-profit-${index}`} fill={winLossColor[index]} />
                                    ))
                                }
                                <Label className='dashboard-pie-label' position='center' value={`$${numberWithCommas(netProfit.toFixed(0))}`} />
                            </Pie>
                            <Tooltip formatter={(value) => '$' + numberWithCommas(value.toFixed(0))} />
                        </PieChart>
                    </ResponsiveContainer>
                    <h4 className='dashboard-card-caption'>Net dollar profit</h4>
                </div>
                {/* % profit card */}
                <div className='dashboard-card dashboard-pie' id='dashboard-percent-profit-pie'>
                    <h3 className='dashboard-card-title'>Percent Profit</h3>
                    <ResponsiveContainer width='100%' height='80%'>
                        <PieChart className='dashboard-pie'>
                            <Pie data={this.state.percentProfitData} dataKey='value' nameKey='name' cx='50%' cy='50%' innerRadius={innerRadius} outerRadius={outerRadius}>
                                {
                                    this.state.percentProfitData.map((entry, index) => (
                                        <Cell key={`cell-profit-${index}`} fill={winLossColor[index]} />
                                    ))
                                }
                                <Label className='dashboard-pie-label' position='center' value={`${annualPercentProfit}% Gain`} />
                            </Pie>
                            <Tooltip formatter={(value) => value.toFixed(2) + '%'} />
                        </PieChart>
                    </ResponsiveContainer>
                    <h4 className='dashboard-card-caption'>Account growth per year</h4>
                </div>
                {/* profit per year */}
                <div className='dashboard-card dashboard-graph' id='dashboard-profit-graph'>
                    <h3 className='dashboard-card-title'>Profit by {bucketType}</h3>
                    <ResponsiveContainer width='100%' height={`90%`}>
                        <AreaChart data={this.state.yearData} >
                            <CartesianGrid />
                            <XAxis dataKey='year' minTickGap={50} height={25} tickFormatter={this.xAxisTickFormatter} />
                            <YAxis domain={[0, 'dataMax']} orientation='left' tickFormatter={v => numberWithCommas(v.toFixed(0))} />
                            <Area dataKey='profit' stroke={winLossColor[0]} fillOpacity={1} fill={`${winLossColor[0]}`} />
                            <Tooltip formatter={value => '$' + numberWithCommas(value.toFixed(0))} labelFormatter={this.xAxisTickFormatter} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
                {/* trades per year */}
                <div className='dashboard-card dashboard-graph' id='dashboard-trade-graph'>
                    <h3 className='dashboard-card-title'>Trades per {bucketType}</h3>
                    <ResponsiveContainer width='100%' height={`90%`}>
                        <BarChart data={this.state.yearData}>
                            <CartesianGrid vertical={false} horizontal={false} />
                            <XAxis dataKey='year' minTickGap={50} height={25} tickFormatter={this.xAxisTickFormatter} />
                            <YAxis domain={['auto', 'auto']} orientation='left' />
                            <Bar dataKey='winTrades' stackId='a' fill={winLossColor[0]} />
                            <Bar dataKey='lossTrades' stackId='a' fill={winLossColor[1]} />
                            <Tooltip labelFormatter={this.xAxisTickFormatter} />
                            {/* <Legend verticalAlign='top' align='right' height={36} /> */}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                {/* Winrate card */}
                <div className='dashboard-card dashboard-pie' id='dashboard-trade-pie'>
                    <h3 className='dashboard-card-title'>Trades</h3>
                    <ResponsiveContainer width='100%' height='80%'>
                        <PieChart className='dashboard-pie'>
                            <Pie data={this.state.winLossData} dataKey='value' nameKey='name' cx='50%' cy='50%' innerRadius={innerRadius} outerRadius={outerRadius}>
                                {
                                    this.state.winLossData.map((entry, index) => (
                                        <Cell key={`cell-trades-${index}`} fill={winLossColor[index]} />
                                    ))
                                }
                                <Label className='dashboard-pie-label' position='center' value={`${winRate.toFixed(0)}% Win`} />
                            </Pie>
                            <Tooltip formatter={(value) => numberWithCommas(value)} />
                        </PieChart>
                    </ResponsiveContainer>
                    <h4 className='dashboard-card-caption'>{numberWithCommas(totalTrades)} total trades</h4>
                </div>
                {/* Span card */}
                <div className='dashboard-card dashboard-pie' id='dashboard-span-pie'>
                    <h3 className='dashboard-card-title'>Span</h3>
                    <ResponsiveContainer width='100%' height='80%'>
                        <PieChart className='dashboard-pie'>
                            <Pie data={this.state.spanData} dataKey='value' nameKey='name' cx='50%' cy='50%' innerRadius={innerRadius} outerRadius={outerRadius}>
                                {
                                    this.state.spanData.map((entry, index) => (
                                        <Cell key={`cell-span-${index}`} fill={winLossColor[index]} />
                                    ))
                                }
                                <Label className='dashboard-pie-label' position='center' value={`${avgSpan} days`} />
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                    <h4 className='dashboard-card-caption'>Number of days in a trade</h4>
                </div>
                <div className='dashboard-card' id='dashboard-indicators'>
                    <h3 className='dashboard-card-title'>Indicators</h3>
                    <div className='dasbhaord-sub-section'>
                        <div>
                            <h4 className='dashboard-card-subtitle'>Buy Criterias</h4>
                            <pre id='json' className='dashboard-indicator'>
                                {buyIndicators}
                            </pre>
                        </div>
                        <div>
                            <h4 className='dashboard-card-subtitle'>Sell Criterias</h4>
                            <pre id='json' className='dashboard-indicator'>
                                {sellIndicators}
                            </pre>
                        </div>
                    </div>
                    <br />
                    <h3 className='dashboard-card-title'>Additional Options</h3>
                    <div className='dasbhaord-sub-section'>
                        {
                            Object.keys(results['strategyOptions']).map(key => {
                                if (key.includes('Indicator')) {
                                    return;
                                }
                                return <>
                                    <h4 className='dashboard-card-subtitle'>{camelToDisplay(key) + ': ' + results['strategyOptions'][key]}</h4>
                                </>
                            })
                        }
                    </div>
                </div>
            </div>
        </div>
    </>;
}

export default Dashboard;