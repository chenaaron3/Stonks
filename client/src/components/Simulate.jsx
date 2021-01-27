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
import Button from '@material-ui/core/Button';

class Simulate extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            equityData: [], returnsData: [],
            range: 25, startSize: 1000, maxPositions: 10, positionSize: 10, maxRisk: 15,
            sizeOnRisk: false, risk: 3,
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

    score = (events, index, scoreData) => {
        let mainEvent = events[index];
        let wins = scoreData["wins"];
        let count = scoreData["count"];
        let score = { "Percent Profit": scoreData["percentProfit"] * count, "Dollar Profit": scoreData["dollarProfit"] * count, "Win Rate": 0 };

        // new stock
        if (index == 0) return score;

        let newRealizedIndex = scoreData["realizedIndex"];
        for (let i = scoreData["realizedIndex"] + 1; i < index; ++i) {
            let event = events[i];
            if (new Date(event["sellDate"]) > new Date(mainEvent["buyDate"])) {
                break;
            }

            newRealizedIndex = i;
            score["Percent Profit"] += event["percentProfit"];
            score["Dollar Profit"] += event["profit"];

            if (event["percentProfit"] > 0) {
                wins += 1;
            }
            count += 1;
        }

        if(count > 0) {
            score["Percent Profit"] /= count;
            score["Dollar Profit"] /= count;
            score["Win Rate"] = wins / count;
        }

        scoreData["realizedIndex"] = newRealizedIndex;
        scoreData["count"] = count;
        scoreData["wins"] = wins;
        scoreData["percentProfit"] = score["Percent Profit"];
        scoreData["dollarProfit"] = score["Dollar Profit"];

        return score;
    }

    simulate = (forGUI, state) => {
        if (forGUI) {
            state = this.state;
        }
        // store all events based on their buy dates
        let eventsByDate = {};
        let dates = new Set();
        let symbols = Object.keys(this.props.results["symbolData"]);
        symbols.forEach(symbol => {
            let score = 0;
            let localityWeight = .8;
            let events = this.props.results["symbolData"][symbol]["events"];
            let scoreData = { realizedIndex: -1, count: 0, wins: 0, percentProfit: 0, dollarProfit: 0 };
            for (let i = 0; i < events.length; ++i) {
                let event = events[i];
                // store symbol and index for future reference
                event["symbol"] = symbol;
                event["index"] = i;
                // only score 1 time
                if (!event.hasOwnProperty("score")) {
                    event["score"] = this.score(events, i, scoreData);
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
        let equity = state.startSize;
        let buyingPower = equity;
        let equityData = []; // equity after reach trade
        let returnsData = []; // percent annual returns
        let transactions = {}; // maps year to list of events
        let startDate = new Date();
        let start = false;
        startDate.setFullYear(startDate.getFullYear() - state.range);
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
            if (this.holdings.length < state.maxPositions) {
                let events = eventsByDate[date];
                if (events) {
                    events.sort((a, b) => b["score"][state.scoreBy] - a["score"][state.scoreBy]);
                    // keep buying until holdings maxed
                    for (let i = 0; i < events.length; ++i) {
                        let event = events[i];

                        // check for risk
                        if (event["risk"] && event["risk"] > state.maxRisk) {
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

                        // Calculate buy amount
                        // Metho1: calculate buy amount by account size
                        if (!state.sizeOnRisk || !event["risk"]) {
                            event["buyAmount"] = equity * (state.positionSize / 100);
                        }
                        // Method2: calculate buy amount by risk
                        else {
                            event["buyAmount"] = equity * (state.risk / 100) / (event["risk"] / 100);
                        }

                        // check if have enough money to buy
                        event["buyAmount"] = Math.min(event["buyAmount"], buyingPower);
                        // deduct from buying power
                        buyingPower -= event["buyAmount"];

                        // add to holdings
                        this.holdings.push(event);

                        // stop buying if max out on holdings or ran out of money
                        if (this.holdings.length >= state.maxPositions || buyingPower == 0) {
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
                    buyingPower += holding["buyAmount"] * (1 + holding["percentProfit"]);

                    // start over in case we bust account
                    if (equity <= 0) {
                        equity = state.startSize;
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

        if (forGUI) {
            this.setState({ equityData, returnsData, loading: false });
            this.props.setSimulationTransactions(transactions);
        }

        return { equity, returnsData };
    }

    findOptimal = async () => {
        let optimalSetting = { scoreBy: "", maxRisk: 0 };
        let optimal = 0;
        for (let i = 0; i < this.scoreTypes.length; ++i) {
            if (i == 1) { continue }
            let scoreBy = this.scoreTypes[i];
            for (let risk = this.minRisk; risk <= this.maxRisk; risk += this.stepRisk) {
                let simulateResults = await this.tryOptimal(scoreBy, risk);
                let equity = simulateResults["equity"];
                let returnsData = simulateResults["returnsData"];
                let recentPerformance = 0;
                returnsData.slice(returnsData.length - 10, returnsData.length).forEach(v => recentPerformance += v["returns"]);
                console.log(recentPerformance);
                if (recentPerformance > optimal) {
                    optimal = recentPerformance;
                    optimalSetting["scoreBy"] = scoreBy;
                    optimalSetting["maxRisk"] = risk;
                }
            }
        }
        this.setState({ ...optimalSetting }, () => this.simulate(true));
        return optimal;
    }

    tryOptimal = (scoreBy, maxRisk) => {
        return new Promise(res => {
            let tempState = { ...this.state, scoreBy, maxRisk };
            let simulateResults = this.simulate(false, tempState);
            res(simulateResults);
        })
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
            </div>
        </div>
    }
}

let mapStateToProps = (state) => {
    let results = state.backtestResults;
    return { results, id: state.id };
};

export default connect(mapStateToProps, { setSimulationTransactions })(Simulate);