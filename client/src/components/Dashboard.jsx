import React, { createRef } from 'react';
import { connect } from 'react-redux';
import { setBacktestResults } from '../redux';
import './Dashboard.css';
import {
    Tooltip, Label, ResponsiveContainer,
    PieChart, Pie, Cell,
    RadialBarChart, RadialBar,
    LineChart, CartesianGrid, XAxis, YAxis, Line,
    Bar, BarChart, Legend,
    AreaChart, Area
} from 'recharts';
import { numberWithCommas, hoursBetween, daysBetween } from "../helpers/utils"
import Button from '@material-ui/core/Button';
import LinearProgress from '@material-ui/core/LinearProgress';
import Box from '@material-ui/core/Box';
import Pusher from 'react-pusher';

let winLossColor = ["#2ecc71", "#FFCCCB"];

class Dashboard extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            numWins: 0, numLosses: 0, winSpan: 0, lossSpan: 0, winProfit: 0, lossProfit: 0, winPercentProfit: 0, lossPercentProfit: 0,
            winLossData: [], spanData: [], percentProfitData: [], profitData: [], yearData: [],
            updateProgress: -1
        }
    }

    componentDidMount() {
        this.analyze();
    }

    componentDidUpdate(prevProps) {
        if (prevProps.id != this.props.id) {
            this.analyze();
        }
    }

    // statistical analysis (win/loss)
    analyze() {
        console.log("Analyzing");
        let winSpan = 0;
        let lossSpan = 0;
        let winProfit = 0;
        let lossProfit = 0;
        let winPercentProfit = 0;
        let lossPercentProfit = 0;
        let numWins = 0;
        let numLosses = 0;
        let yearlyData = {};
        // get the sorted symbols
        let sortedSymbols = Object.keys(this.props.results["symbolData"]);
        sortedSymbols.sort((a, b) => this.props.results["symbolData"][b]["percentProfit"] - this.props.results["symbolData"][a]["percentProfit"]);
        this.setState({ sortedSymbols }, () => {
            this.state.sortedSymbols.forEach(symbol => {
                this.props.results["symbolData"][symbol]["events"].forEach(event => {
                    let buyYear = (new Date(event["buyDate"])).getFullYear();
                    if (!yearlyData.hasOwnProperty(buyYear)) {
                        yearlyData[buyYear] = { winTrades: 0, lossTrades: 0, profit: 0 };
                    }

                    if (event["profit"] < 0) {
                        numLosses += 1;
                        lossSpan += event["span"];
                        lossProfit += event["profit"];
                        lossPercentProfit += event["percentProfit"];
                        yearlyData[buyYear]["lossTrades"]++;
                    }
                    else if (event["profit"] > 0) {
                        numWins += 1;
                        winSpan += event["span"];
                        winProfit += event["profit"];
                        winPercentProfit += event["percentProfit"];
                        yearlyData[buyYear]["winTrades"]++;
                    }
                    yearlyData[buyYear]["profit"] += event["profit"];
                })
            })
            // span adjustments
            winSpan /= numWins;
            winSpan = Math.floor(winSpan);
            lossSpan /= numLosses;
            lossSpan = Math.floor(lossSpan);

            // percent profit adjustments
            winPercentProfit /= numWins;
            winPercentProfit = (100 * winPercentProfit);
            lossPercentProfit /= numLosses;
            lossPercentProfit = (100 * lossPercentProfit);

            let winRate = (numWins) / (numWins + numLosses);
            let annualWinPercentProfit = winPercentProfit * 360 / winSpan * (winRate);
            let annualLossPercentProfit = lossPercentProfit * 360 / lossSpan * (1 - winRate);

            let winLossData = [{
                "name": "Wins",
                "value": numWins
            },
            {
                "name": "Losses",
                "value": numLosses
            }];

            let spanData = [{
                "name": "Win Span",
                "value": winSpan,
            },
            {
                "name": "Loss Span",
                "value": lossSpan,
            }];

            let percentProfitData = [{
                "name": "Win % Profit",
                "value": annualWinPercentProfit
            },
            {
                "name": "Loss % Profit",
                "value": Math.abs(annualLossPercentProfit)
            }]

            let profitData = [{
                "name": "Win Profit",
                "value": winProfit
            },
            {
                "name": "Loss Profit",
                "value": Math.abs(lossProfit)
            }]

            let yearData = [];
            let years = Object.keys(yearlyData);
            years.sort();
            let profit = 0;
            years.forEach(year => {
                profit += yearlyData[year]["profit"];
                yearData.push({ year, ...yearlyData[year], profit });
            })

            // assign to state
            this.setState({
                numWins, numLosses, winSpan, lossSpan, winProfit, lossProfit, winPercentProfit: annualWinPercentProfit, lossPercentProfit: annualLossPercentProfit,
                winLossData, spanData, percentProfitData, profitData, yearData
            });
        });
    }

    // send request to update a backtest
    updateBacktest = () => {
        this.setState({ updateProgress: 0 });
        fetch(`${process.env.NODE_ENV == "production" ? process.env.REACT_APP_SUBDIRECTORY : ""}/updateBacktest?id=${this.props.id}`)
            .then(res => res.json())
            .then(json => alert(json["status"]));
    }

    // reload the page when update is complete
    fetchBacktestResults = (id) => {
        fetch(`${process.env.NODE_ENV == "production" ? process.env.REACT_APP_SUBDIRECTORY : ""}/results?id=${id}`, {
            method: 'GET'
        }).then(res => res.json())
            .then(results => {
                // store results in global state
                this.props.setBacktestResults(id, results);
            });
    }

    tradeTooltipFormatter = (value, name, props) => {
        return value.toFixed(4);
    }

    render() {
        let totalTrades = this.state.numWins + this.state.numLosses;
        let winRate = (100 * (this.state.numWins) / (this.state.numWins + this.state.numLosses));
        let avgSpan = Math.floor((this.state.winSpan * this.state.numWins + this.state.lossSpan * this.state.numLosses) / (this.state.numWins + this.state.numLosses));
        let netProfit = (this.state.winProfit + this.state.lossProfit);
        let annualPercentProfit = (this.state.winPercentProfit + this.state.lossPercentProfit).toFixed(0);
        let lastUpdated = new Date(this.props.results["lastUpdated"]);
        let daysBetweenUpdate = daysBetween(lastUpdated, new Date());
        let hoursBetweenUpdate = hoursBetween(lastUpdated, new Date());

        let buyIndicators = JSON.stringify(this.props.results["strategyOptions"]["buyIndicators"], null, 2).replace(/[{},"]/g, "");
        buyIndicators = buyIndicators.split("\n").filter(x => x.trim().length > 0).join("\n");
        let sellIndicators = JSON.stringify(this.props.results["strategyOptions"]["sellIndicators"], null, 2).replace(/[{},"]/g, "");
        sellIndicators = sellIndicators.split("\n").filter(x => x.trim().length > 0).join("\n");

        let innerRadius = "70%";
        let outerRadius = "90%";

        return <>
            <Pusher
                channel={this.props.id}
                event="onProgressUpdate"
                onUpdate={(data) => { this.setState({ updateProgress: data["progress"] }) }}
            />
            <Pusher
                channel={this.props.id}
                event="onUpdateFinished"
                onUpdate={(data) => { this.fetchBacktestResults(data["id"]) }}
            />
            <div className="dashboard">
                <div className="dashboard-header">
                    <span className="dashboard-title">Backtest Summary</span>
                    <div className="dashboard-update">
                        {
                            this.state.updateProgress < 0 && <span className="dashboard-update-text">Updated {daysBetweenUpdate > 0 ? `${daysBetweenUpdate} days ago` : `${hoursBetweenUpdate} hours ago`}</span>
                        }
                        {
                            this.state.updateProgress >= 0 && <span className="dashboard-update-text">Updating</span>
                        }
                        {daysBetweenUpdate > 0 && (
                            <>
                                {
                                    this.state.updateProgress < 0 && <Box ml="1vw" ><Button variant="contained" color="primary" onClick={this.updateBacktest}>
                                        Update
                                    </Button></Box>
                                }
                                {
                                    this.state.updateProgress >= 0 && (
                                        <>
                                            <Box ml="1vw" ><LinearProgress className="dashboard-progress" variant="determinate" value={this.state.updateProgress} /></Box>
                                        </>
                                    )
                                }
                            </>
                        )}
                    </div>
                </div>
                <div className="dashboard-body">
                    {/* profit card */}
                    <div className="dashboard-card dashboard-pie" id="dashboard-profit-pie">
                        <h3 className="dashboard-card-title">Profit</h3>
                        <ResponsiveContainer width="100%" height="80%">
                            <PieChart className="dashboard-pie">
                                <Pie data={this.state.profitData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={innerRadius} outerRadius={outerRadius}>
                                    {
                                        this.state.profitData.map((entry, index) => (
                                            <Cell key={`cell-profit-${index}`} fill={winLossColor[index]} />
                                        ))
                                    }
                                    <Label className="dashboard-pie-label" position="center" value={`$${numberWithCommas(netProfit.toFixed(0))}`} />
                                </Pie>
                                <Tooltip formatter={(value) => "$" + numberWithCommas(value.toFixed(0))} />
                            </PieChart>
                        </ResponsiveContainer>
                        <h4 className="dashboard-card-caption">Net dollar profit</h4>
                    </div>
                    {/* % profit card */}
                    <div className="dashboard-card dashboard-pie" id="dashboard-percent-profit-pie">
                        <h3 className="dashboard-card-title">Percent Profit</h3>
                        <ResponsiveContainer width="100%" height="80%">
                            <PieChart className="dashboard-pie">
                                <Pie data={this.state.percentProfitData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={innerRadius} outerRadius={outerRadius}>
                                    {
                                        this.state.percentProfitData.map((entry, index) => (
                                            <Cell key={`cell-profit-${index}`} fill={winLossColor[index]} />
                                        ))
                                    }
                                    <Label className="dashboard-pie-label" position="center" value={`${annualPercentProfit}% Gain`} />
                                </Pie>
                                <Tooltip formatter={(value) => value.toFixed(2) + "%"} />
                            </PieChart>
                        </ResponsiveContainer>
                        <h4 className="dashboard-card-caption">Account growth per year</h4>
                    </div>
                    {/* profit per year */}
                    <div className="dashboard-card dashboard-graph" id="dashboard-profit-graph">
                        <h3 className="dashboard-card-title">Profit by year</h3>
                        <ResponsiveContainer width="100%" height={`90%`}>
                            <AreaChart data={this.state.yearData} >
                                <CartesianGrid />
                                <XAxis dataKey="year" minTickGap={50} height={25} tickFormatter={this.xAxisTickFormatter} />
                                <YAxis domain={[0, "dataMax"]} orientation="left" tickFormatter={v => numberWithCommas(v.toFixed(0))} />
                                <Area dataKey="profit" stroke={winLossColor[0]} fillOpacity={1} fill={`${winLossColor[0]}`} />
                                <Tooltip formatter={(value) => "$" + numberWithCommas(value.toFixed(0))} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    {/* trades per year */}
                    <div className="dashboard-card dashboard-graph" id="dashboard-trade-graph">
                        <h3 className="dashboard-card-title">Trades per year</h3>
                        <ResponsiveContainer width="100%" height={`90%`}>
                            <BarChart data={this.state.yearData}>
                                <CartesianGrid vertical={false} horizontal={false} />
                                <XAxis dataKey="year" minTickGap={50} height={25} tickFormatter={this.xAxisTickFormatter} />
                                <YAxis domain={["auto", "auto"]} orientation="left" />
                                <Bar dataKey="winTrades" stackId="a" fill={winLossColor[0]} />
                                <Bar dataKey="lossTrades" stackId="a" fill={winLossColor[1]} />
                                <Tooltip />
                                {/* <Legend verticalAlign="top" align="right" height={36} /> */}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    {/* Winrate card */}
                    <div className="dashboard-card dashboard-pie" id="dashboard-trade-pie">
                        <h3 className="dashboard-card-title">Trades</h3>
                        <ResponsiveContainer width="100%" height="80%">
                            <PieChart className="dashboard-pie">
                                <Pie data={this.state.winLossData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={innerRadius} outerRadius={outerRadius}>
                                    {
                                        this.state.winLossData.map((entry, index) => (
                                            <Cell key={`cell-trades-${index}`} fill={winLossColor[index]} />
                                        ))
                                    }
                                    <Label className="dashboard-pie-label" position="center" value={`${winRate.toFixed(0)}% Win`} />
                                </Pie>
                                <Tooltip formatter={(value) => numberWithCommas(value)} />
                            </PieChart>
                        </ResponsiveContainer>
                        <h4 className="dashboard-card-caption">{numberWithCommas(totalTrades)} total trades</h4>
                    </div>
                    {/* Span card */}
                    <div className="dashboard-card dashboard-pie" id="dashboard-span-pie">
                        <h3 className="dashboard-card-title">Span</h3>
                        <ResponsiveContainer width="100%" height="80%">
                            <PieChart className="dashboard-pie">
                                <Pie data={this.state.spanData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={innerRadius} outerRadius={outerRadius}>
                                    {
                                        this.state.spanData.map((entry, index) => (
                                            <Cell key={`cell-span-${index}`} fill={winLossColor[index]} />
                                        ))
                                    }
                                    <Label className="dashboard-pie-label" position="center" value={`${avgSpan} days`} />
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <h4 className="dashboard-card-caption">Number of days in a trade</h4>
                    </div>
                    <div className="dashboard-card dashboard-indicator" id="dashboard-indicators">
                        <h3 className="dashboard-card-title">Indicators</h3>
                        <div>
                            <h4 className="dashboard-card-subtitle">Buy Criterias</h4>
                            <pre id="json" className="dashboard-indicator">
                                {buyIndicators}
                            </pre>
                        </div>
                        <div>
                            <h4 className="dashboard-card-subtitle">Sell Criterias</h4>
                            <pre id="json" className="dashboard-indicator">
                                {sellIndicators}
                            </pre>
                        </div>
                    </div>
                </div>
            </div>
        </>;
    }
}

let mapStateToProps = (state) => {
    let results = state.backtestResults;
    return { results, id: state.id };
};

export default connect(mapStateToProps, { setBacktestResults })(Dashboard);