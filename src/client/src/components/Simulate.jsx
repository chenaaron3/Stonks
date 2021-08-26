import React, { createRef } from 'react';
import { connect } from 'react-redux';
import { setSimulationTransactions, setTradeSettings } from '../redux';
import Loading from './Loading';
import "./Simulate.css";

import {
    Tooltip, Label, ResponsiveContainer,
    PieChart, Pie, Cell,
    RadialBarChart, RadialBar,
    LineChart, CartesianGrid, XAxis, YAxis, Line,
    Bar, BarChart, Legend,
    AreaChart, Area
} from 'recharts';
import { numberWithCommas, simulateBacktest, findOptimalRisk } from "../helpers/utils"
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import Slider from '@material-ui/core/Slider';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import { mean, median, standardDeviation, min, max } from 'simple-statistics'

class Simulate extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            equityData: [], returnsData: [], buyingPowerData: [], positionData: [],
            range: 25, startSize: 1000, maxPositions: 10, positionSize: 10, maxRisk: 15,
            sizeOnRisk: false, risk: 1,
            scoreBy: "Win Rate",
            loading: true
        }

        this.holdings = [];
        this.scoreTypes = ["Percent Profit", "Dollar Profit", "Win Rate"];

        this.minRisk = 5;
        this.maxRisk = 50;
        this.stepRisk = 5;
    }

    componentDidMount() {
        this.simulate(true);
    }

    componentDidUpdate(prevProps) {
        if (prevProps.id != this.props.id) {
            this.simulate(true);
        }
    }

    simulate = (forGUI, state) => {
        if (forGUI) {
            state = this.state;
        }
        let { transactions, // for review
            equityData, returnsData, buyingPowerData, positionData,// for charts
            equity, weightedReturns, sharpe // for comparison
        } = simulateBacktest(state, this.props.results);
        if (forGUI) {
            this.setState({ equityData, returnsData, buyingPowerData, positionData, loading: false });
            this.props.setSimulationTransactions(transactions);
        }
        return { equity, weightedReturns, sharpe };
    }

    findOptimal = async () => {
        let { settings } = findOptimalRisk(this.state, this.props.results);
        this.setState({ ...settings }, () => this.simulate(true));
        console.log(settings);
    }

    formatDate = (date) => {
        let formatted = (date.getMonth() + 1) + "/" + date.getFullYear();
        return formatted;
    }

    xAxisTickFormatter = (date) => {
        if (typeof date == "number") {
            let d = new Date();
            d.setTime(date);
            return this.formatDate(d);
        }
        else {
            return this.formatDate(date);
        }
    }

    handleScoreByChange = (e) => {
        this.setState({ scoreBy: this.scoreTypes[e.target.value] }, () => {
            this.simulate(true);
        })
    }

    render() {
        let winLossColor = ["#2ecc71", "#FFCCCB"];
        return <div className="simulate">
            <div className="simulate-header">
                <Loading loading={this.state.loading} />
                <h3 className="simulate-title">Equity Chart</h3>
                <div className="simulate-settings">
                    <Box mx="1vw" mt="1vh">
                        <FormControl style={{ minWidth: "5vw" }}>
                            <InputLabel id="simualte-score-type">Score By</InputLabel>
                            <Select
                                value={this.scoreTypes.indexOf(this.state.scoreBy)}
                                onChange={this.handleScoreByChange}
                            >
                                {
                                    this.scoreTypes.map((value, index) => {
                                        return <MenuItem key={`simulate-score-${index}`} value={index}>{value}</MenuItem>
                                    })
                                }
                            </Select>
                        </FormControl>
                    </Box>
                    <Box mx="1vw" mt="1vh">
                        <FormControl style={{ minWidth: "5vw" }}>
                            <InputLabel id="simulate-chart-range">Year Range</InputLabel>
                            <Slider
                                defaultValue={50}
                                aria-labelledby="discrete-slider"
                                valueLabelDisplay="auto"
                                value={this.state.range}
                                onChange={(e, v) => { this.setState({ range: v }, () => { this.simulate(true) }) }}
                                step={5}
                                marks
                                min={5}
                                max={100}
                            />
                        </FormControl>
                    </Box>
                    <Box mx="1vw" mt="1vh">
                        <FormControl style={{ minWidth: "5vw" }}>
                            <InputLabel id="simulate-chart-positions">Positions</InputLabel>
                            <Slider
                                defaultValue={5}
                                aria-labelledby="discrete-slider"
                                valueLabelDisplay="auto"
                                value={this.state.maxPositions}
                                onChange={(e, v) => {
                                    this.setState({ maxPositions: v, positionSize: Math.min(Math.floor(100 / v), this.state.positionSize) },
                                        () => { this.simulate(true) })
                                }}
                                step={1}
                                marks
                                min={1}
                                max={20}
                            />
                        </FormControl>
                    </Box>
                    <Box mx="1vw" mt="1vh">
                        <FormControl style={{ minWidth: "5vw" }}>
                            <InputLabel id="simulate-chart-size">Position Size</InputLabel>
                            <Slider
                                defaultValue={10}
                                aria-labelledby="discrete-slider"
                                valueLabelDisplay="auto"
                                value={this.state.positionSize}
                                onChange={(e, v) => { this.setState({ positionSize: v }, () => { this.simulate(true) }) }}
                                step={1}
                                marks
                                min={1}
                                max={Math.floor(100 / this.state.maxPositions)}
                            />
                        </FormControl>
                    </Box>
                    <Box mx="1vw" mt="1vh">
                        <FormControl style={{ minWidth: "5vw" }}>
                            <InputLabel id="simulate-chart-size">Max Risk</InputLabel>
                            <Slider
                                defaultValue={10}
                                aria-labelledby="discrete-slider"
                                valueLabelDisplay="auto"
                                value={this.state.maxRisk}
                                onChange={(e, v) => { this.setState({ maxRisk: v }, () => { this.simulate(true) }) }}
                                step={this.stepRisk}
                                marks
                                min={this.minRisk}
                                max={this.maxRisk}
                            />
                        </FormControl>
                    </Box>
                    <Box ml="1vw" ><Button variant="contained" color="primary" onClick={this.findOptimal}>
                        Find Optimal
                        </Button>
                    </Box>
                </div>
            </div>
            <div className="simulate-equity">
                <ResponsiveContainer width="100%" height={`70%`}>
                    <AreaChart data={this.state.equityData} >
                        <CartesianGrid />
                        <XAxis dataKey="date" minTickGap={50} height={25} tickFormatter={this.xAxisTickFormatter} />
                        <YAxis domain={[0, "dataMax"]} orientation="left" />
                        <Area dataKey="equity" stroke={winLossColor[0]} fillOpacity={1} fill={`${winLossColor[0]}`} />
                        <Tooltip formatter={(value) => "$" + numberWithCommas(value.toFixed(0))} labelFormatter={this.xAxisTickFormatter} />
                    </AreaChart>
                </ResponsiveContainer>
                <ResponsiveContainer width="100%" height={`30%`}>
                    <BarChart data={this.state.returnsData}>
                        <CartesianGrid vertical={false} horizontal={false} />
                        <XAxis dataKey="year" minTickGap={50} height={25} />
                        <YAxis domain={["auto", "auto"]} orientation="left" />
                        <Bar dataKey="returns" stackId="a" fill={winLossColor[0]} />
                        <Tooltip formatter={(value) => value.toFixed(2) + "%"} />
                    </BarChart>
                </ResponsiveContainer>
                {/* <ResponsiveContainer width="100%" height={`10%`}>
                    <BarChart data={this.state.positionData}>
                        <CartesianGrid vertical={false} horizontal={false} />
                        <XAxis dataKey="year" minTickGap={50} height={25} />
                        <YAxis domain={["auto", "auto"]} orientation="left" />
                        <Bar dataKey="positions" stackId="a" fill={winLossColor[0]} />
                        <Tooltip formatter={(value) => value.toFixed(2) + "%"} />
                    </BarChart>
                </ResponsiveContainer>
                <ResponsiveContainer width="100%" height={`10%`}>
                    <AreaChart data={this.state.buyingPowerData} >
                        <CartesianGrid />
                        <XAxis dataKey="date" minTickGap={50} height={25} tickFormatter={this.xAxisTickFormatter} />
                        <YAxis domain={[0, "dataMax"]} orientation="left" />
                        <Area dataKey="buyingPower" stroke={winLossColor[0]} fillOpacity={1} fill={`${winLossColor[0]}`} />
                        <Tooltip formatter={(value) => "$" + numberWithCommas(value.toFixed(0))} labelFormatter={this.xAxisTickFormatter} />
                    </AreaChart>
                </ResponsiveContainer> */}
            </div>
        </div>
    }
}

let mapStateToProps = (state) => {
    let results = state.backtestResults;
    return { results, id: state.id };
};

export default connect(mapStateToProps, { setSimulationTransactions, setTradeSettings })(Simulate);