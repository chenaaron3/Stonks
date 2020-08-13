import React, { createRef } from 'react';
import { connect } from 'react-redux';
import { viewStock, setBacktestResults } from '../redux';
import './SymbolResults.css';
import 'react-tabs/style/react-tabs.css';
import { formatDate, daysBetween } from "../helpers/utils";

class SymbolResults extends React.Component {
    constructor(props) {
        super(props);
        this.state = { averageSpan: 0 }
    }

    // statistical analysis
    analyze() {
        let averageSpan = 0;
        this.props.results["events"].forEach(event => {
            averageSpan += event["span"];
        })
        this.setState({ averageSpan: averageSpan / this.props.results["events"].length });
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

        return (
            <>
                <div className="symbol-results">
                    <h1 className="symbol-results-title">Results for <br /> {this.props.symbol}</h1>
                    <div>Profit: ${profit}</div>
                    <div>Percent Profit: {percentProfit}%</div>
                    <div>Average Span: {this.state.averageSpan}</div>
                </div>
            </>
        );
    }
}

let mapStateToProps = (state) => {
    return { results: state["backtestResults"]["symbolData"][state.selectedSymbol], symbol: state.selectedSymbol };
};

export default connect(mapStateToProps)(SymbolResults);
