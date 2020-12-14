import React, { createRef } from 'react';
import { connect } from 'react-redux';
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
import Box from '@material-ui/core/Box';

class Simulate extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            data: [],
            range: 50, startSize: 1000, maxPositions: 20, positionSize: 5
        }

        this.holdings = [];
    }

    componentDidMount() {
        this.simulate();
    }

    componentDidUpdate(prevProps) {
        if (prevProps.id != this.props.id) {
            this.simulate();
        }
    }

    score = (events, index) => {
        let score = 0;
        let localityWeight = .7;
        let mainEvent = events[index];
        for (let i = 0; i < index; ++i) {
            let event = events[i];
            if (new Date(event["sellDate"]) > new Date(mainEvent["buyDate"])) {
                break;
            }
            // let newScore = event["percentProfit"] > 0 ? 1 : -1;
            // score = newScore * localityWeight + score * (1 - localityWeight);
            score += event["percentProfit"] > 0 ? 1 : 0;
        }
        return score / (index + 1);
    }

    simulate = () => {
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
                event["score"] = this.score(events, i);
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
        let data = [];
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

            // if looking for buys
            if (this.holdings.length < this.state.maxPositions) {
                let events = eventsByDate[date];
                if (events) {
                    events.sort((a, b) => b["score"] - a["score"]);
                    // keep buying until holdings maxed
                    for (let i = 0; i < events.length; ++i) {
                        let event = events[i];
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
                // time to sell
                if (date == new Date(holding["sellDate"]).getTime()) {
                    sold.push(holding);
                    equity += holding["buyAmount"] * (holding["percentProfit"]);
                    if (equity <= 0) {
                        equity = this.state.startSize;
                    }
                }
            })
            this.holdings = this.holdings.filter(h => !sold.includes(h));

            data.push({ date: date, equity });
        }

        // sell off all holdings
        let last = data[data.length - 1];
        this.holdings.forEach(holding => {
            equity += holding["buyAmount"] * (holding["percentProfit"]);
        })
        last["equity"] = equity;

        this.setState({ data });
    }

    formatDate = (date) => {
        let formatted = (date.getMonth() + 1) + "/" + date.getFullYear();
        return formatted;
    }

    xAxisTickFormatter = (date) => {
        let d = new Date();
        d.setTime(date);
        return this.formatDate(d);
    }

    render() {
        let winLossColor = ["#2ecc71", "#FFCCCB"];
        return <div className="simulate">
            <div className="simulate-header">
                <h3 className="simulate-title">Equity Chart</h3>
                <div className="simulate-settings">
                    <Box mx="1vw" mt="1vh">
                        <FormControl style={{ minWidth: "5vw" }}>
                            <InputLabel id="simulate-chart-range">Year Range</InputLabel>
                            <Slider
                                defaultValue={50}
                                aria-labelledby="discrete-slider"
                                valueLabelDisplay="auto"
                                value={this.state.range}
                                onChange={(e, v) => { this.setState({ range: v }, () => { this.simulate() }) }}
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
                                onChange={(e, v) => { this.setState({ maxPositions: v }, () => { this.simulate() }) }}
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
                                onChange={(e, v) => { this.setState({ positionSize: v }, () => { this.simulate() }) }}
                                step={1}
                                marks
                                min={1}
                                max={Math.floor(100 / this.state.maxPositions)}
                            />
                        </FormControl>
                    </Box>
                </div>
            </div>
            <div className="simulate-equity">
                <ResponsiveContainer width="100%" height={`100%`}>
                    <AreaChart data={this.state.data} >
                        <CartesianGrid />
                        <XAxis dataKey="date" minTickGap={50} height={25} tickFormatter={this.xAxisTickFormatter} />
                        <YAxis domain={[0, "dataMax"]} orientation="left" />
                        <Area dataKey="equity" stroke={winLossColor[0]} fillOpacity={1} fill={`${winLossColor[0]}`} />
                        <Tooltip formatter={(value) => "$" + numberWithCommas(value.toFixed(0))} labelFormatter={this.xAxisTickFormatter} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    }
}

let mapStateToProps = (state) => {
    let results = state.backtestResults;
    return { results, id: state.id };
};

export default connect(mapStateToProps)(Simulate);