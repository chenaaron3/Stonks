import React, { createRef } from 'react';
import { connect } from 'react-redux';
import { viewStock, setBacktestResults } from '../redux';
import './Results.css';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import eye from "../eye.svg";
import buy from "../buy.svg";
import bought from "../bought.svg";
import sell from "../sell.svg";
import { formatDate, daysBetween } from "../helpers/utils";
import Pusher from 'react-pusher';

class Results extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            numWins: 0, numLosses: 0, winSpan: 0, lossSpan: 0, winProfit: 0, lossProfit: 0, winPercentProfit: 0, lossPercentProfit: 0,
            sortedSymbols: [], recentThreshold: 7, boughtSymbols: {}, search: "", updateProgress: -1
        }
    }

    // when clicking on an item
    handleGetResult = (symbol) => {
        this.props.viewStock(symbol)
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
        // get the sorted symbols
        let sortedSymbols = Object.keys(this.props.results["symbolData"]);
        sortedSymbols.sort((a, b) => this.props.results["symbolData"][b]["percentProfit"] - this.props.results["symbolData"][a]["percentProfit"]);
        this.setState({ sortedSymbols }, () => {
            this.state.sortedSymbols.forEach(symbol => {
                this.props.results["symbolData"][symbol]["events"].forEach(event => {
                    if (event["profit"] < 0) {
                        numLosses += 1;
                        lossSpan += event["span"];
                        lossProfit += event["profit"];
                        lossPercentProfit += event["percentProfit"];
                    }
                    else {
                        numWins += 1;
                        winSpan += event["span"];
                        winProfit += event["profit"];
                        winPercentProfit += event["percentProfit"];
                    }
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

            // assign to state
            this.setState({ numWins, numLosses, winSpan, lossSpan, winProfit, lossProfit, winPercentProfit, lossPercentProfit });
        });
    }

    componentDidMount() {
        this.analyze();
        this.getBoughtSymbols();
    }

    componentDidUpdate(prevProps) {
        if (prevProps.id != this.props.id) {
            this.analyze();
            this.getBoughtSymbols();
        }
    }

    // send request to update a backtest
    updateBacktest = () => {
        this.setState({ updateProgress: 0 });
        fetch(`${process.env.REACT_APP_SUBDIRECTORY}/updateBacktest?id=${this.props.id}`);
    }

    // load initial bought list
    getBoughtSymbols = () => {
        fetch("/boughtSymbols")
            .then(res => res.json())
            .then(boughtSymbols => {
                this.setState({ boughtSymbols });
            })
    }

    // mark as bought
    buySymbol = (symbol, date) => {
        fetch(`/buySymbol?symbol=${symbol}&date=${date}`)
            .then(res => res.json())
            .then(boughtSymbols => {
                this.setState({ boughtSymbols });
            })
    }

    // sell
    sellSymbol = (symbol) => {
        fetch(`/sellSymbol?symbol=${symbol}`)
            .then(res => res.json())
            .then(boughtSymbols => {
                this.setState({ boughtSymbols });
            })
    }

    // reload the page when update is complete
    fetchBacktestResults = (id) => {
        fetch(`${process.env.REACT_APP_SUBDIRECTORY}/results?id=${id}`, {
            method: 'GET'
        }).then(res => res.json())
            .then(results => {
                // store results in global state
                this.props.setBacktestResults(id, results);
            });
    }

    render() {
        let netProfit = (this.state.winProfit + this.state.lossProfit).toFixed(4);
        let annualWinPercentProfit = this.state.winPercentProfit * 360 / this.state.winSpan;
        let annualLossPercentProfit = this.state.lossPercentProfit * 360 / this.state.lossSpan;
        let annualPercentProfit = (annualWinPercentProfit + annualLossPercentProfit).toFixed(4);
        let lastRecentDate = new Date()
        lastRecentDate.setDate(lastRecentDate.getDate() - this.state.recentThreshold);

        let search = this.state.search.toLowerCase().trim();
        let searchResults = this.state.sortedSymbols.filter(s => s.toLowerCase().includes(search));
        let searchBar = <input className="results-search" value={this.state.search} onChange={e => { this.setState({ search: e.target.value }) }} />;

        return (
            <div className="results">
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
                            {this.state.sortedSymbols.length == 0 && (<span>
                                There are no results...
                            </span>)
                            }
                            {this.state.sortedSymbols.length != 0 && (
                                <>
                                    <h2>General Stats</h2>
                                    <div>Trades: {this.state.numWins + this.state.numLosses}</div>
                                    <div>Win Rate: {(this.state.numWins / (this.state.numLosses + this.state.numWins) * 100).toFixed(2)}%</div>
                                    <div>Net Profit: ${netProfit}</div>
                                    <div>Average Span: {Math.floor((this.state.winSpan * this.state.numWins + this.state.lossSpan * this.state.numLosses) / (this.state.numWins + this.state.numLosses))} days</div>
                                    <div>Annual Percent Profit: {annualPercentProfit}%</div>
                                    <div>Last Updated: {formatDate(new Date(this.props.results["lastUpdated"]))}</div>
                                    {daysBetween(new Date(this.props.results["lastUpdated"]), new Date()) > 0 && (
                                        <>
                                            {
                                                this.state.updateProgress < 0 && <input type="button" value="Update Backtest" onClick={this.updateBacktest} />
                                            }
                                            {
                                                this.state.updateProgress >= 0 && (
                                                    <>
                                                        <hr />
                                                        <div style={{
                                                            backgroundImage: `linear-gradient(to right, #2ecc71 ${this.state.updateProgress}%, rgb(0, 0, 0, 0) ${this.state.updateProgress}%)`,
                                                            textAlign: "center"
                                                        }}>
                                                            Updating...
                                                    </div>
                                                    </>
                                                )
                                            }
                                        </>
                                    )}
                                    <hr />

                                    <h2>Win Stats</h2>
                                    <div>Win Trades: {this.state.numWins}</div>
                                    <div>Win Profit: ${this.state.winProfit.toFixed(4)}</div>
                                    <div>Win Percent Profit: {this.state.winPercentProfit.toFixed(4)}%</div>
                                    <div>Win Span: {this.state.winSpan} days</div>
                                    <hr />

                                    <h2>Loss Stats</h2>
                                    <div>Loss Trades: {this.state.numLosses}</div>
                                    <div>Loss Profit: ${this.state.lossProfit.toFixed(4)}</div>
                                    <div>Loss Percent Profit: {this.state.lossPercentProfit.toFixed(4)}%</div>
                                    <div>Loss Span: {this.state.lossSpan} days</div>
                                    <hr />

                                    <h2>Indicators Used</h2>
                                    <div>
                                        <div>Buy Indicators:</div>
                                        <pre id="json" className="results-indicators">{JSON.stringify(this.props.results["strategyOptions"]["buyIndicators"], null, 2).replace(/[{},"]/g, "")}</pre>
                                        <div>Sell Indicators:</div>
                                        <pre id="json" className="results-indicators">{JSON.stringify(this.props.results["strategyOptions"]["sellIndicators"], null, 2).replace(/[{},"]/g, "")}</pre>
                                    </div>
                                </>
                            )
                            }
                        </div>
                    </TabPanel>
                    <TabPanel>
                        <div className="results-list">
                            {this.state.sortedSymbols.length == 0 && (<span>
                                There are no results...
                            </span>)
                            }
                            {this.state.sortedSymbols.length != 0 && (
                                <>
                                    {searchBar}
                                    {
                                        this.state.sortedSymbols.map((symbol, index) => {
                                            if (searchResults.includes(symbol)) {
                                                return <Result key={index} symbol={symbol} index={index} result={this.props.results["symbolData"][symbol]}
                                                    handleGetResult={this.handleGetResult} />
                                            }
                                        })
                                    }
                                </>
                            )
                            }
                        </div>
                    </TabPanel>
                    <TabPanel>
                        <div className="results-list">
                            {this.state.sortedSymbols.length == 0 && (<span>
                                There are no results...
                            </span>)
                            }
                            {this.state.sortedSymbols.length != 0 && (
                                <>
                                    {searchBar}
                                    {
                                        this.state.sortedSymbols.map((symbol, index) => {
                                            // only show if there are recent events
                                            let numEvents = this.props.results["symbolData"][symbol]["holdings"].filter(d => new Date(d) > lastRecentDate).length;
                                            if (numEvents > 0) {
                                                if (searchResults.includes(symbol)) {
                                                    return <Result buy key={index} symbol={symbol} index={index} result={this.props.results["symbolData"][symbol]}
                                                        handleGetResult={this.handleGetResult} buySymbol={this.buySymbol} sellSymbol={this.sellSymbol}
                                                        boughtSymbols={this.state.boughtSymbols} />
                                                }
                                            }
                                        })
                                    }
                                </>
                            )
                            }
                        </div>
                    </TabPanel>
                    <TabPanel>
                        <div className="results-list">
                            {this.state.sortedSymbols.length == 0 && (<span>
                                There are no results...
                            </span>)
                            }
                            <>
                                {searchBar}
                                {this.state.sortedSymbols.length != 0 && (
                                    this.state.sortedSymbols.map((symbol, index) => {
                                        // only show if there are recent events
                                        let events = this.props.results["symbolData"][symbol]["events"];
                                        let numEvents = events.filter(e => new Date(e["sellDate"]) > lastRecentDate).length;
                                        if (numEvents > 0) {
                                            if (searchResults.includes(symbol)) {
                                                return <Result sell key={index} symbol={symbol} index={index} result={this.props.results["symbolData"][symbol]}
                                                    handleGetResult={this.handleGetResult} buySymbol={this.buySymbol} sellSymbol={this.sellSymbol}
                                                    boughtSymbols={this.state.boughtSymbols} />
                                            }
                                        }
                                    })
                                )
                                }
                            </>
                        </div>
                    </TabPanel>
                </Tabs>
            </div>
        );
    }
}

class Result extends React.Component {
    state = { hovered: false }

    buySymbol = () => {
        this.props.buySymbol(this.props.symbol, new Date().toISOString());
    }

    sellSymbol = () => {
        this.props.sellSymbol(this.props.symbol);
    }

    render() {
        return (<div className="result" onMouseEnter={() => this.setState({ hovered: true })} onMouseLeave={() => this.setState({ hovered: false })}>
            <img className={`result-icon result-hover`} width="25px" height="25px" src={eye} alt="Eye" onClick={() => this.props.handleGetResult(this.props.symbol)} />
            <span className="result-text" style={{ color: `${this.props.result["percentProfit"] > 0 ? "green" : "red"}` }}>{`${this.props.index + 1}. ${this.props.symbol}`}</span>
            {
                this.props.buy && !this.props.boughtSymbols.hasOwnProperty(this.props.symbol) && (
                    <img className={`result-trailer ${this.state.hovered ? "result-hover" : ""}`} width="35px" height="35px" src={buy} alt="Buy"
                        onClick={this.buySymbol} />)
            }
            {
                this.props.buy && this.props.boughtSymbols.hasOwnProperty(this.props.symbol) && (
                    <img className={`result-trailer result-hover`} width="35px" height="35px" src={bought} alt="Bought"
                        onClick={this.sellSymbol} />)
            }
            {
                this.props.sell && !this.props.boughtSymbols.hasOwnProperty(this.props.symbol) && (
                    <img className={`result-trailer ${this.state.hovered ? "result-hover" : ""}`} width="35px" height="35px" src={buy} alt="Buy"
                        onClick={this.buySymbol} />)
            }
            {
                this.props.sell && this.props.boughtSymbols.hasOwnProperty(this.props.symbol) && (
                    <img className={`result-trailer result-hover`} width="35px" height="35px" src={sell} alt="Sell"
                        onClick={this.sellSymbol} />)
            }

        </div>);
    }
}

let mapStateToProps = (state) => {
    let results = state.backtestResults;
    return { results, id: state.id };
};

export default connect(mapStateToProps, { viewStock, setBacktestResults })(Results);
