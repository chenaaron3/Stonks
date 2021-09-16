import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { setSimulationTransactions } from '../redux/slices/backtestSlice';
import { setSimulateSettings } from '../redux/slices/userSlice';
import { setLoading } from '../redux/slices/uiSlice';
import './Simulate.css';

import {
    Tooltip, Label, ResponsiveContainer,
    PieChart, Pie, Cell,
    RadialBarChart, RadialBar,
    LineChart, CartesianGrid, XAxis, YAxis, Line,
    Bar, BarChart, Legend,
    AreaChart, Area
} from 'recharts';
import { numberWithCommas, simulateBacktest, findOptimalRisk } from '../helpers/utils'
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import Slider from '@material-ui/core/Slider';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';

import { SortBy, SimulateReturnsData, SimulateChartData } from '../types/common';

const Simulate: React.FC = () => {
    const scoreTypes: SortBy[] = ['Percent Profit', 'Dollar Profit', 'Win Rate'];

    const dispatch = useAppDispatch();
    const results = useAppSelector(state => state.backtest.results);
    const simulateSettings = useAppSelector(state => state.user.simulateSettings);

    const [chartData, setChartData] = useState({
        equityData: [] as SimulateChartData[],
        returnsData: [] as SimulateReturnsData[],
        buyingPowerData: [] as SimulateChartData[],
        positionData: [] as SimulateChartData[]
    })

    useEffect(() => {
        simulate();
    }, []);

    useEffect(() => {
        simulate();
    }, [simulateSettings]);

    const simulate = () => {
        let state = simulateSettings;
        let { transactions, // for review
            equityData, returnsData, buyingPowerData, positionData,// for charts
            equity, weightedReturns, sharpe // for comparison
        } = simulateBacktest(state, { ...results });
        setChartData({
            equityData, returnsData, buyingPowerData, positionData
        });
        dispatch(setLoading(false));
        dispatch(setSimulationTransactions(transactions));
        return { equity, weightedReturns, sharpe };
    }

    const findOptimal = async () => {
        let { settings } = findOptimalRisk(simulateSettings, results);
        dispatch(setSimulateSettings({ scoreBy: settings['scoreBy'] as SortBy, maxRisk: settings['maxRisk'] }));
    }

    const formatDate = (date: Date) => {
        let formatted = (date.getMonth() + 1) + '/' + date.getFullYear();
        return formatted;
    }

    const xAxisTickFormatter = (date: number | Date) => {
        if (typeof date == 'number') {
            let d = new Date();
            d.setTime(date);
            return formatDate(d);
        }
        else {
            return formatDate(date);
        }
    }

    let winLossColor = ['#2ecc71', '#FFCCCB'];
    return <div className='simulate'>
        <div className='simulate-header'>
            <h3 className='simulate-title'>Equity Chart</h3>
            <div className='simulate-settings'>
                <Box mx='1vw' mt='1vh'>
                    <FormControl style={{ minWidth: '5vw' }}>
                        <InputLabel id='simualte-score-type'>Score By</InputLabel>
                        <Select
                            value={scoreTypes.indexOf(simulateSettings['scoreBy'])}
                            onChange={(e) => dispatch(setSimulateSettings({ scoreBy: scoreTypes[e.target.value as number] }))}
                        >
                            {
                                scoreTypes.map((value, index) => {
                                    return <MenuItem key={`simulate-score-${index}`} value={index}>{value}</MenuItem>
                                })
                            }
                        </Select>
                    </FormControl>
                </Box>
                <Box mx='1vw' mt='1vh'>
                    <FormControl style={{ minWidth: '5vw' }}>
                        <InputLabel id='simulate-chart-range'>Year Range</InputLabel>
                        <Slider
                            defaultValue={50}
                            aria-labelledby='discrete-slider'
                            valueLabelDisplay='auto'
                            value={simulateSettings['range']}
                            onChange={(e, v) => dispatch(setSimulateSettings({ range: v as number }))}
                            step={5}
                            marks
                            min={5}
                            max={100}
                        />
                    </FormControl>
                </Box>
                <Box mx='1vw' mt='1vh'>
                    <FormControl style={{ minWidth: '5vw' }}>
                        <InputLabel id='simulate-chart-positions'>Positions</InputLabel>
                        <Slider
                            defaultValue={5}
                            aria-labelledby='discrete-slider'
                            valueLabelDisplay='auto'
                            value={simulateSettings['maxPositions']}
                            onChange={(e, v) => {
                                dispatch(setSimulateSettings({
                                    maxPositions: v as number,
                                    positionSize: Math.min(Math.floor(100 / (v as number)), simulateSettings['positionSize'])
                                }))
                            }}
                            step={1}
                            marks
                            min={1}
                            max={20}
                        />
                    </FormControl>
                </Box>
                <Box mx='1vw' mt='1vh'>
                    <FormControl style={{ minWidth: '5vw' }}>
                        <InputLabel id='simulate-chart-size'>Position Size</InputLabel>
                        <Slider
                            defaultValue={10}
                            aria-labelledby='discrete-slider'
                            valueLabelDisplay='auto'
                            value={simulateSettings['positionSize']}
                            onChange={(e, v) => dispatch(setSimulateSettings({
                                positionSize: v as number
                            }))}
                            step={1}
                            marks
                            min={1}
                            max={Math.floor(100 / simulateSettings['maxPositions'])}
                        />
                    </FormControl>
                </Box>
                <Box mx='1vw' mt='1vh'>
                    <FormControl style={{ minWidth: '5vw' }}>
                        <InputLabel id='simulate-chart-size'>Max Risk</InputLabel>
                        <Slider
                            defaultValue={10}
                            aria-labelledby='discrete-slider'
                            valueLabelDisplay='auto'
                            value={simulateSettings['maxRisk']}
                            onChange={(e, v) => dispatch(setSimulateSettings({
                                maxRisk: v as number
                            }))}
                            step={5}
                            marks
                            min={0}
                            max={50}
                        />
                    </FormControl>
                </Box>
                <Box ml='1vw' ><Button variant='contained' color='primary' onClick={findOptimal}>
                    Find Optimal
                </Button>
                </Box>
            </div>
        </div>
        <div className='simulate-equity'>
            <ResponsiveContainer width='100%' height={`70%`}>
                <AreaChart data={chartData['equityData']} >
                    <CartesianGrid />
                    <XAxis dataKey='date' minTickGap={50} height={25} tickFormatter={xAxisTickFormatter} />
                    <YAxis domain={[0, 'dataMax']} orientation='left' />
                    <Area dataKey='value' stroke={winLossColor[0]} fillOpacity={1} fill={`${winLossColor[0]}`} />
                    <Tooltip formatter={(value: number) => '$' + numberWithCommas(value.toFixed(0))} labelFormatter={xAxisTickFormatter} />
                </AreaChart>
            </ResponsiveContainer>
            <ResponsiveContainer width='100%' height={`30%`}>
                <BarChart data={chartData['returnsData']}>
                    <CartesianGrid vertical={false} horizontal={false} />
                    <XAxis dataKey='year' minTickGap={50} height={25} />
                    <YAxis domain={['auto', 'auto']} orientation='left' />
                    <Bar dataKey='returns' stackId='a' fill={winLossColor[0]} />
                    <Tooltip formatter={(value: number) => value.toFixed(2) + '%'} />
                </BarChart>
            </ResponsiveContainer>
            {/* <ResponsiveContainer width='100%' height={`10%`}>
                <BarChart data={chartData['positionData']}>
                    <CartesianGrid vertical={false} horizontal={false} />
                    <XAxis dataKey='date' minTickGap={50} height={25} />
                    <YAxis domain={['auto', 'auto']} orientation='left' />
                    <Bar dataKey='value' stackId='a' fill={winLossColor[0]} />
                    <Tooltip formatter={(value: number) => value.toFixed(2) + '%'} />
                </BarChart>
            </ResponsiveContainer>
            <ResponsiveContainer width='100%' height={`10%`}>
                <AreaChart data={chartData['buyingPowerData']} >
                    <CartesianGrid />
                    <XAxis dataKey='date' minTickGap={50} height={25} tickFormatter={xAxisTickFormatter} />
                    <YAxis domain={[0, 'dataMax']} orientation='left' />
                    <Area dataKey='value' stroke={winLossColor[0]} fillOpacity={1} fill={`${winLossColor[0]}`} />
                    <Tooltip formatter={(value: number) => '$' + numberWithCommas(value.toFixed(0))} labelFormatter={xAxisTickFormatter} />
                </AreaChart>
            </ResponsiveContainer> */}
        </div>
    </div>
}

export default Simulate;