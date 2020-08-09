import React from 'react';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import eye from "../eye.svg";
import { formatDate, daysBetween } from "../helpers/utils";

class Result extends React.Component {
    render() {
        console.log(this.props);
        let netProfit = this.props.results["netProfit"].toFixed(2);
        let percentProfit = (100 * this.props.results["netPercentProfit"]).toFixed(4);
        
        return <Tabs>
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
                            <div>Net Profit: ${netProfit}</div>
                            <div>Net Percent Profit: {percentProfit}%</div>
                            <div>Indicators Used: {Object.keys(this.props.results["strategyOptions"]["indicators"]).join(", ")}</div>
                            <div>Last Updated: {formatDate(new Date(this.props.results["lastUpdated"]))}</div>
                            {daysBetween(new Date(this.props.results["lastUpdated"]), new Date()) > 0 && (
                                <input type="button" value="Update Results"/>
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
                            return <ResultViewer key={index} symbol={symbol} index={index} handleGetResult={this.props.handleGetResult} />
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
                                return <ResultViewer key={index} symbol={symbol} index={index} handleGetResult={this.props.handleGetResult} />
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
                                return <ResultViewer key={index} symbol={symbol} index={index} handleGetResult={this.props.handleGetResult} />
                            }
                        })
                    )
                    }
                </div>
            </TabPanel>
        </Tabs>;
    }
}

class ResultViewer extends React.Component {
    render() {
        return (<div className="result">
            <img className="result-icon result-hover" width="25px" height="25px" src={eye} alt="Eye" onClick={() => this.props.handleGetResult(this.props.symbol)} />
            <span className="result-text">{`${this.props.index + 1}. ${this.props.symbol}`}</span>
        </div>);
    }
}

export default Result;