import React, { createRef } from 'react';
import { connect } from 'react-redux';
import { setSimulationTransactions } from '../redux';
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
import { numberWithCommas } from "../helpers/utils"
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import Slider from '@material-ui/core/Slider';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import Box from '@material-ui/core/Box';

class Simulate extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            equityData: [], returnsData: [],
            range: 25, startSize: 1000, maxPositions: 10, positionSize: 10, maxRisk: 15,
            scoreBy: "Win Rate",
            loading: true
        }

        this.holdings = [];
        this.scoreTypes = ["Percent Profit", "Dollar Profit", "Win Rate"];
    }

    componentDidMount() {
        this.simulate(false);
    }

    componentDidUpdate(prevProps) {
        if (prevProps.id != this.props.id) {
            this.simulate(false);
        }
    }

    score = (events, index) => {
        let score = { "Percent Profit": 0, "Dollar Profit": 0, "Win Rate": 0 };
        let mainEvent = events[index];
        let wins = 0;
        let count = 0;
        for (let i = 0; i < index; ++i) {
            let event = events[i];
            if (new Date(event["sellDate"]) > new Date(mainEvent["buyDate"])) {
                break;
            }

            score["Percent Profit"] += event["percentProfit"];
            score["Dollar Profit"] += event["profit"];
            score["Custom"] += event["percentProfit"] > 0 ? 1 : 0;

            if (event["percentProfit"] > 0) {
                wins += 1;
            }
            count += 1;
        }

        score["Custom"] /= (index + 1);
        score["Win Rate"] = wins / count;

        return score;
    }

    simulate = (forceScore) => {
        // store all events based on their buy dates
        let eventsByDate = {};
        let dates = new Set();
        let symbols = Object.keys(this.props.results["symbolData"]);
        symbols.forEach(symbol => {
            let score = 0;
            let localityWeight = .8;
            let events = this.props.results["symbolData"][symbol]["events"];
            for (let i = 0; i < events.length; ++i) {
                let event = events[i];
                // store symbol and index for future reference
                event["symbol"] = symbol;
                event["index"] = i;
                // only score 1 time
                if (!event.hasOwnProperty("score")) {
                    event["score"] = this.score(events, i);
                }
                let newScore = event["percentProfit"] > 0 ? 1 : -1;
                score = newScore * localityWeight + score * (1 - localityWeight);
                let buyDate = new Date(event["buyDate"]).getTime();
                let sellDate = new Date(event["sellDate"]).getTime();
                if (!dates.has(buyDate)) {
                    dates.add(buyDate);
                }
                if (!dates.has(sellDate)) {
                    dates.add(sellDate);
                }
                if (!eventsByDate.hasOwnProperty(buyDate)) {
                    eventsByDate[buyDate] = [];
                }
                eventsByDate[buyDate].push(event);
            };
        });

        // sort the dates to simulate
        dates = [...dates];
        dates.sort((a, b) => {
            return new Date(parseInt(a)) - new Date(parseInt(b))
        });

        // start simulation
        let equity = this.state.startSize;
        let equityData = []; // equity after reach trade
        let returnsData = []; // percent annual returns
        let transactions = {}; // maps year to list of events
        let startDate = new Date();
        let start = false;
        startDate.setFullYear(startDate.getFullYear() - this.state.range);
        for (let i = 0; i < dates.length; ++i) {
            let date = dates[i];

            // check start
            if (!start) {
                // past start
                if (new Date(parseInt(date)) > startDate) {
                    start = true;
                }
                // keep searching
                else {
                    continue;
                }
            }

            // if looking for buyers
            if (this.holdings.length < this.state.maxPositions) {
                let events = eventsByDate[date];
                if (events) {
                    events.sort((a, b) => b["score"][this.state.scoreBy] - a["score"][this.state.scoreBy]);
                    // keep buying until holdings maxed
                    for (let i = 0; i < events.length; ++i) {
                        let event = events[i];

                        // check for risk
                        if (event["risk"] && event["risk"] > this.state.maxRisk) {
                            continue;
                        }

                        // add event to transactions
                        let d = new Date();
                        d.setTime(date);
                        let y = d.getFullYear();
                        if (!transactions.hasOwnProperty(y)) {
                            transactions[y] = [];
                        }
                        transactions[y].push(event);

                        // add to holdings
                        this.holdings.push(event);
                        event["buyAmount"] = equity * (this.state.positionSize / 100);
                        if (this.holdings.length >= this.state.maxPositions) {
                            break;
                        }
                    }
                };
            }

            // check sells
            let sold = [];
            this.holdings.forEach(holding => {
                let sellDate = new Date(holding["sellDate"]);
                // time to sell
                if (date == sellDate.getTime()) {
                    sold.push(holding);
                    equity += holding["buyAmount"] * (holding["percentProfit"]);

                    // start over in case we bust account
                    if (equity <= 0) {
                        equity = this.state.startSize;
                    }
                }
            })
            this.holdings = this.holdings.filter(h => !sold.includes(h));

            equityData.push({ date: date, equity });
        }

        // sell off all holdings
        let last = equityData[equityData.length - 1];
        this.holdings.forEach(holding => {
            equity += holding["buyAmount"] * (holding["percentProfit"]);
        })
        last["equity"] = equity;

        // calculate the returns for each year
        let currentYear = 0;
        equityData.forEach(ed => {
            let d = new Date();
            d.setTime(ed["date"]);
            let y = d.getFullYear();

            // first record of year
            if (y != currentYear) {
                // update last year's returns
                if (returnsData.length > 0) {
                    let rd = returnsData[returnsData.length - 1];
                    rd["returns"] = (ed["equity"] - rd["startingEquity"]) / rd["startingEquity"] * 100;
                }
                returnsData.push({ year: y, startingEquity: ed["equity"] });
            }

            // update current year
            currentYear = y;
        })

        // calculate returns for last year
        last = returnsData[returnsData.length - 1];
        if (!last.hasOwnProperty("returns")) {
            last["returns"] = (equityData[equityData.length - 1]["equity"] - last["startingEquity"]) / last["startingEquity"] * 100;
        }

        this.setState({ equityData, returnsData, loading: false });
        this.props.setSimulationTransactions(transactions);
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
                <Loading loading = {this.state.loading}/>
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
                                onChange={(e, v) => { this.setState({ range: v }, () => { this.simulate(false) }) }}
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
                                        () => { this.simulate(false) })
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
                                onChange={(e, v) => { this.setState({ positionSize: v }, () => { this.simulate(false) }) }}
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
                                onChange={(e, v) => { this.setState({ maxRisk: v }, () => { this.simulate(false) }) }}
                                step={5}
                                marks
                                min={1}
                                max={100}
                            />
                        </FormControl>
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
            </div>
        </div>
    }
}

let mapStateToProps = (state) => {
    let results = state.backtestResults;
    return { results, id: state.id };
};

export default connect(mapStateToProps, { setSimulationTransactions })(Simulate);