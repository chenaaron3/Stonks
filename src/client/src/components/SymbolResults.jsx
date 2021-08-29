import React, {  } from 'react';
import { connect } from 'react-redux';
import { viewEvent, viewStock } from '../redux';
import './SymbolResults.css';
import 'react-tabs/style/react-tabs.css';
import { formatDate, daysBetween } from "../helpers/utils";
import ArrowForwardSharpIcon from '@material-ui/icons/ArrowForwardSharp';
import CasinoIcon from '@material-ui/icons/Casino';
import IconButton from '@material-ui/core/IconButton';

class SymbolResults extends React.Component {
    constructor(props) {
        super(props);
        this.state = { numWins: 0, numLosses: 0, averageSpan: 0, latestPrice: 0 }
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

        // fetch latest price
        fetch(`${process.env.NODE_ENV == "production" ? process.env.REACT_APP_SUBDIRECTORY : ""}/symbol/latestPrice?symbol=${this.props.symbol}`)
            .then(res => res.json())
            .then(latestPrice => this.setState({ latestPrice: latestPrice["close"] }))
    }

    componentDidMount() {
        this.analyze();        
    }

    componentDidUpdate(prevProps) {
        if (prevProps.results != this.props.results) {
            this.analyze();
        }
    }

    onDiceRoll = () => {
        let randomIndex = Math.floor(Math.random() * this.props.results["events"].length);
        this.props.viewEvent(randomIndex);
    }

    render() {
        let profit = this.props.results["profit"].toFixed(2);
        let percentProfit = (100 * this.props.results["percentProfit"]).toFixed(4);
        let averageSpan = Math.floor(this.state.averageSpan);
        let reversedEvents = [...this.props.results["events"]].reverse();

        return (
            <>
                <div className="symbol-results">
                    <IconButton className="symbol-results-random" style={{ position: "absolute" }} onClick={this.onDiceRoll}>
                        <CasinoIcon />
                    </IconButton>
                    <h2 className="symbol-results-title">{this.props.symbol}<br/>${this.state.latestPrice.toFixed(2)}</h2>
                    <div className="symbol-results-body">
                        <div>Wins: {this.state.numWins}</div>
                        <div>Losses: {this.state.numLosses}</div>
                        <div>Win Rate: {(this.state.numWins / (this.state.numLosses + this.state.numWins) * 100).toFixed(2)}%</div>
                        <div>Profit: ${profit}</div>
                        <div>Percent Profit: {percentProfit}%</div>
                        <div>Average Span: {averageSpan} days</div>
                    </div>
                    <h3 className="symbol-results-subtitle">Events</h3>
                    <div className="symbol-results-events">
                        {
                            reversedEvents.map((event, index) => {
                                return (<div className="symbol-results-event" key={`symbol-results-${index}`} onClick={() => { this.props.viewEvent(this.props.results["events"].length - 1 - index) }}
                                    style={{ color: `${event["percentProfit"] > 0 ? "green" : "red"}` }}>
                                    <span>{formatDate(event["buyDate"])}</span>
                                    <ArrowForwardSharpIcon />
                                    <span>{formatDate(event["sellDate"])}</span>
                                </div>);
                            })
                        }
                    </div>
                </div>
            </>
        );
    }
}

let mapStateToProps = (state) => {
    return { results: state["backtestResults"]["symbolData"][state.selectedSymbol], symbol: state.selectedSymbol };
};

export default connect(mapStateToProps, { viewEvent, viewStock })(SymbolResults);
