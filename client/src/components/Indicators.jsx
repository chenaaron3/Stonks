import React, { createRef } from 'react';
import './Indicators.css';
import caret from "../arrow.svg";
import { connect } from 'react-redux';
import { setIndicatorOption, setIndicatorOn, setID } from '../redux';
import Indicator from "./Indicator";

class Indicators extends React.Component {
    constructor(props) {
        super(props);
        this.state = { step: 0, mainBuyIndicator: "", mainSelIndicator: "" };
        this.indicators = {
            "SMA": { "fields": ["period"], "default": [9] },
            "EMA": { "fields": ["period"], "default": [5] },
            "RSI": { "fields": ["period", "underbought", "overbought"], "default": [14, 30, 70] },
            "MACD": { "fields": ["ema1", "ema2", "signalPeriod"], "default": [12, 26, 9] },
            "GC": { "fields": ["ma1Period", "ma2Period"], "default": [15, 50] },
            "ADX": { "fields": ["period", "threshold"], "default": [14, 20] },
            "Structure": { "fields": ["period", "volatility"], "default": [75, .05] },
            "ATR": { "fields": ["period"], "default": [12] },
            "Divergence": { "fields": ["period"], "default": [10] },
            "Stochastic": { "fields": ["period", "underbought", "overbought"], "default": [14, 20, 80] },
        }
    }

    componentDidMount() {
        // Set default values for all indicators
        Object.keys(this.indicators).map((indicatorName, index) => {
            // if used in backtest, use backtest options
            if (this.props.backtestIndicatorOptions.hasOwnProperty(indicatorName)) {
                Object.keys(this.props.backtestIndicatorOptions[indicatorName]).forEach(field => {
                    this.props.setIndicatorOption(indicatorName, field, this.props.backtestIndicatorOptions[indicatorName][field]);
                });
                Object.keys(this.indicators).forEach(indicatorName => {
                    this.props.setIndicatorOn(indicatorName, this.props.backtestIndicatorOptions.hasOwnProperty(indicatorName));
                })
            }
            // if not used in backtest, use default values
            else {
                // initialize global state with default values
                this.indicators[indicatorName]["fields"].map((field, index) => {
                    this.props.setIndicatorOption(indicatorName, field, this.indicators[indicatorName]["default"][index]);
                })
            }
        })

        // Special Cases
        if (this.props.backtestIndicatorOptions.hasOwnProperty("Divergence")) {
            this.props.setIndicatorOption("RSI", this.indicators["RSI"]["fields"][0], this.indicators["RSI"]["default"][0]);
            this.props.setIndicatorOption("RSI", this.indicators["RSI"]["fields"][1], 0);
            this.props.setIndicatorOption("RSI", this.indicators["RSI"]["fields"][2], 100);
            this.props.setIndicatorOn("RSI", true);
        }
    }

    render() {
        let activeIndicators = [...this.props.activeIndicators];
        return (
            <div className="indicators">
                <h2 className="indicators-title">Indicators</h2>
                <div className="indicators-list">
                    {Object.keys(this.indicators).map((indicatorName, index) => {
                        return <Indicator name={indicatorName} fields={this.indicators[indicatorName]["fields"]} default={this.indicators[indicatorName]["default"]} key={index}
                            setIndicatorOption={this.props.setIndicatorOption} setIndicatorOn={this.props.setIndicatorOn} active={activeIndicators.includes(indicatorName)}
                            options={this.props.indicatorOptions[indicatorName]} />
                    })}
                </div>
            </div>
        );
    }
}

let mapStateToProps = (state) => {
    return { indicatorOptions: state.indicatorOptions, activeIndicators: state.activeIndicators, backtestIndicatorOptions: state.backtestResults["strategyOptions"]["buyIndicators"] };
};

export default connect(mapStateToProps, { setIndicatorOption, setIndicatorOn, setID })(Indicators);
