import React, { createRef } from 'react';
import { connect } from 'react-redux';
import './Dashboard.css';
import {
    PieChart, Pie, Cell, Tooltip, Label, ResponsiveContainer, RadialBarChart, RadialBar, LineChart, CartesianGrid, XAxis, YAxis, Line, Bar, BarChart, Legend
} from 'recharts';
import { numberWithCommas } from "../helpers/utils"

let winLossColor = ["#2ecc71", "#FFCCCB"];

class Dashboard extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            numWins: 0, numLosses: 0, winSpan: 0, lossSpan: 0, winProfit: 0, lossProfit: 0, winPercentProfit: 0, lossPercentProfit: 0,
            winLossData: [], spanData: [], percentProfitData: [], profitData: [], yearData: []
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

    tradeTooltipFormatter = (value, name, props) => {
        return value.toFixed(4);
    }

    render() {
        let totalTrades = this.state.numWins + this.state.numLosses;
        let winRate = (100 * (this.state.numWins) / (this.state.numWins + this.state.numLosses));
        let avgSpan = Math.floor((this.state.winSpan * this.state.numWins + this.state.lossSpan * this.state.numLosses) / (this.state.numWins + this.state.numLosses));
        let netProfit = (this.state.winProfit + this.state.lossProfit);
        let annualPercentProfit = (this.state.winPercentProfit + this.state.lossPercentProfit).toFixed(0);
        return <>
            <div className="dashboard">
                <h1>Backtest Overview</h1>
                <div className="dashboard-pie-cards">
                    {/* Winrate card */}
                    <div className="dashboard-card dashboard-pie">
                        <h3 className="dashboard-card-title">Trades</h3>
                        <ResponsiveContainer width="100%" height="80%">
                            <PieChart className="dashboard-pie">
                                <Pie data={this.state.winLossData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={80} outerRadius={100}>
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
                    <div className="dashboard-card dashboard-pie">
                        <h3 className="dashboard-card-title">Span</h3>
                        <ResponsiveContainer width="100%" height="80%">
                            <PieChart className="dashboard-pie">
                                <Pie data={this.state.spanData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={80} outerRadius={100}>
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
                        <h4 className="dashboard-card-caption">Number of days per trade</h4>
                    </div>
                    {/* profit card */}
                    <div className="dashboard-card dashboard-pie">
                        <h3 className="dashboard-card-title">Profit</h3>
                        <ResponsiveContainer width="100%" height="80%">
                            <PieChart className="dashboard-pie">
                                <Pie data={this.state.profitData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={80} outerRadius={100}>
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
                    <div className="dashboard-card dashboard-pie">
                        <h3 className="dashboard-card-title">Percent Profit</h3>
                        <ResponsiveContainer width="100%" height="80%">
                            <PieChart className="dashboard-pie">
                                <Pie data={this.state.percentProfitData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={80} outerRadius={100}>
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
                        <h4 className="dashboard-card-caption">Annual percent profit</h4>
                    </div>
                    <br />
                    {/* trades per year */}
                    <div className="dashboard-card dashboard-graph">
                        <ResponsiveContainer width="100%" height={`100%`}>
                            <BarChart data={this.state.yearData} wrapperStyle={{ top: 0, left: 25 }}>
                                <CartesianGrid vertical={false} horizontal={false} />
                                <XAxis dataKey="year" minTickGap={50} height={25} tickFormatter={this.xAxisTickFormatter} />
                                <YAxis domain={["auto", "auto"]} orientation="left" />
                                <Bar dataKey="winTrades" stackId="a" fill={winLossColor[0]} />
                                <Bar dataKey="lossTrades" stackId="a" fill={winLossColor[1]} />
                                <Tooltip />
                                <Legend verticalAlign="top" align="right" height={36} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    {/* profit per year */}
                    <div className="dashboard-card dashboard-graph">
                        <ResponsiveContainer width="100%" height={`100%`}>
                            <LineChart data={this.state.yearData}>
                                <CartesianGrid vertical={false} horizontal={false} />
                                <XAxis dataKey="year" minTickGap={50} height={25} tickFormatter={this.xAxisTickFormatter} />
                                <YAxis domain={["auto", "auto"]} orientation="left" />
                                <Line dataKey="profit" stroke="#ff7300" />
                                <Tooltip />
                            </LineChart>
                        </ResponsiveContainer>
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

export default connect(mapStateToProps)(Dashboard);