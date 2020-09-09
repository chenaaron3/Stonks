import React, { createRef } from 'react';
import { connect } from 'react-redux';
import { viewEvent } from '../redux';
import './SymbolResults.css';
import 'react-tabs/style/react-tabs.css';
import { formatDate, daysBetween } from "../helpers/utils";

class SymbolResults extends React.Component {
    constructor(props) {
        super(props);
        this.state = { numWins: 0, numLosses: 0, averageSpan: 0 }
    }

    // statistical analysis
    analyze() {
        let numWins = 0;
        let numLosses = 0;
        let averageSpan = 0;
        this.props.results["events"].forEach(event => {
            if (event["profit"] > 0) {
                numWins += 1;
            }
            if (event["profit"] < 0) {
                numLosses += 1;
            }
            averageSpan += event["span"];
        })
        this.setState({ numWins, numLosses, averageSpan: averageSpan / this.props.results["events"].length });
    }

    componentDidMount() {
        this.analyze();
    }

    componentDidUpdate(prevProps) {
        if (prevProps.results != this.props.results) {
            this.analyze();
        }
    }

    render() {
        let profit = this.props.results["profit"].toFixed(2);
        let percentProfit = (100 * this.props.results["percentProfit"]).toFixed(4);
        let averageSpan = Math.floor(this.state.averageSpan);

        return (
            <>
                <div className="symbol-results">
                    <h1 className="symbol-results-title">{this.props.symbol}</h1>
                    <div className="symbol-results-body">
                        <div>Wins: {this.state.numWins}</div>
                        <div>Losses: {this.state.numLosses}</div>
                        <div>Win Rate: {(this.state.numWins / (this.state.numLosses + this.state.numWins) * 100).toFixed(2)}%</div>
                        <div>Profit: ${profit}</div>
                        <div>Percent Profit: {percentProfit}%</div>
                        <div>Average Span: {averageSpan} days</div>
                        <h3>All Buy/Sell Events</h3>
                        <div className="symbol-results-events">
                            {
                                this.props.results["events"].map((event, index) => {
                                    return (<div>
                                        <span style={{color: `${event["percentProfit"] > 0 ? "green" : "red"}`}} key={`symbol-results-${index}`} onClick={() => { this.props.viewEvent(index) }}>{formatDate(event["buyDate"])} to {formatDate(event["sellDate"])}</span>
                                    </div>);
                                })
                            }
                        </div>
                    </div>
                </div>
            </>
        );
    }
}

let mapStateToProps = (state) => {
    return { results: state["backtestResults"]["symbolData"][state.selectedSymbol], symbol: state.selectedSymbol };
};

export default connect(mapStateToProps, { viewEvent })(SymbolResults);
