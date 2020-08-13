import React, { createRef } from 'react';
import { connect } from 'react-redux';
import { viewStock, setBacktestResults } from '../redux';
import './Results.css';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import eye from "../eye.svg";
import { formatDate, daysBetween } from "../helpers/utils";
import Pusher from 'react-pusher';

class Results extends React.Component {
    constructor(props) {
        super(props);
        this.state = { numWins: 0, numLosses: 0 }
    }

    // when clicking on an item
    handleGetResult = (symbol) => {
        this.props.viewStock(symbol)
    }

    // statistical analysis
    analyze() {
        let numWins = 0;
        let numLosses = 0;
        this.props.sortedSymbols.forEach(symbol => {
            this.props.results["symbolData"][symbol]["events"].forEach(event => {
                if (event["profit"] < 0) {
                    numLosses += 1;
                }
                else {
                    numWins += 1;
                }
            })
        })
        this.setState({ numWins, numLosses });
    }

    componentDidMount() {
        this.analyze();
    }

    componentDidUpdate(prevProps) {
        if (prevProps.results != this.props.results) {
            this.analyze();
        }
    }

    // send request to update a backtest
    updateBacktest = () => {
        fetch(`updateBacktest?id=${this.props.id}`);
    }

    // callback when a backtest is updated
    onUpdateFinished = (data) => {
        let id = data["id"];

        // get the data from the server
        fetch(`/results?id=${id}`, {
            method: 'GET'
        }).then(res => res.json())
            .then(results => {
                // store results in global state
                this.props.setBacktestResults(id, results);
            });
    }

    render() {
        let netProfit = this.props.results["netProfit"].toFixed(2);
        let percentProfit = (100 * this.props.results["netPercentProfit"]).toFixed(4);

        return (
            <div className="results">
                <Pusher
                    channel={this.props.id}
                    event="onUpdateFinished"
                    onUpdate={this.onUpdateFinished}
                />
                <span className="results-title">Backtest Results</span>
                <Tabs>
                    <TabList>
                        <Tab>Summary</Tab>
                        <Tab>All</Tab>
                        <Tab>Buys</Tab>
                        <Tab>Sells</Tab>
                    </TabList>
                    <TabPanel>
                        <div className="results-list">
                            {this.props.sortedSymbols.length == 0 && (<span>
                                There are no results...
                            </span>)
                            }
                            {this.props.sortedSymbols.length != 0 && (
                                <>
                                    <div>Wins: {this.state.numWins}</div>
                                    <div>Losses: {this.state.numLosses}</div>
                                    <div>Win Rate: {(this.state.numWins / (this.state.numLosses + this.state.numWins) * 100).toFixed(2)}%</div>
                                    <div>Net Profit: ${netProfit}</div>
                                    <div>Net Percent Profit: {percentProfit}%</div>
                                    <div>Buy Indicators: {Object.keys(this.props.results["strategyOptions"]["buyIndicators"]).join(", ")}</div>
                                    <div>Sell Indicators: {Object.keys(this.props.results["strategyOptions"]["sellIndicators"]).join(", ")}</div>
                                    <div>Last Updated: {formatDate(new Date(this.props.results["lastUpdated"]))}</div>
                                    {daysBetween(new Date(this.props.results["lastUpdated"]), new Date()) > 0 && (
                                        <input type="button" value="Update Backtest" onClick={this.updateBacktest} />
                                    )}
                                </>
                            )
                            }
                        </div>
                    </TabPanel>
                    <TabPanel>
                        <div className="results-list">
                            {this.props.sortedSymbols.length == 0 && (<span>
                                There are no results...
                            </span>)
                            }
                            {this.props.sortedSymbols.length != 0 && (
                                this.props.sortedSymbols.map((symbol, index) => {
                                    return <Result key={index} symbol={symbol} index={index} handleGetResult={this.handleGetResult} />
                                })
                            )
                            }
                        </div>
                    </TabPanel>
                    <TabPanel>
                        <div className="results-list">
                            {this.props.sortedSymbols.length == 0 && (<span>
                                There are no results...
                            </span>)
                            }
                            {this.props.sortedSymbols.length != 0 && (
                                this.props.sortedSymbols.map((symbol, index) => {
                                    // only show if there are recent events
                                    let recentEvents = this.props.results["symbolData"][symbol]["recent"];
                                    let numEvents = recentEvents["buy"].length;
                                    if (numEvents > 0) {
                                        return <Result key={index} symbol={symbol} index={index} handleGetResult={this.handleGetResult} />
                                    }
                                })
                            )
                            }
                        </div>
                    </TabPanel>
                    <TabPanel>
                        <div className="results-list">
                            {this.props.sortedSymbols.length == 0 && (<span>
                                There are no results...
                            </span>)
                            }
                            {this.props.sortedSymbols.length != 0 && (
                                this.props.sortedSymbols.map((symbol, index) => {
                                    // only show if there are recent events
                                    let recentEvents = this.props.results["symbolData"][symbol]["recent"];
                                    let numEvents = recentEvents["sell"].length;
                                    if (numEvents > 0) {
                                        return <Result key={index} symbol={symbol} index={index} handleGetResult={this.handleGetResult} />
                                    }
                                })
                            )
                            }
                        </div>
                    </TabPanel>
                </Tabs>
            </div>
        );
    }
}

class Result extends React.Component {
    render() {
        return (<div className="result">
            <img className="result-icon result-hover" width="25px" height="25px" src={eye} alt="Eye" onClick={() => this.props.handleGetResult(this.props.symbol)} />
            <span className="result-text">{`${this.props.index + 1}. ${this.props.symbol}`}</span>
        </div>);
    }
}

let mapStateToProps = (state) => {
    let results = state.backtestResults;
    let sortedSymbols = Object.keys(results["symbolData"]);
    sortedSymbols.sort((a, b) => results["symbolData"][b]["profit"] - results["symbolData"][a]["profit"]);
    return { sortedSymbols, results, id: state.id };
};

export default connect(mapStateToProps, { viewStock, setBacktestResults })(Results);
