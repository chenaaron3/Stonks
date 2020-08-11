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
            "RSI": { "fields": ["period", "underbought", "overbought"], "default": [14, 30, 70] },
            "MACD": { "fields": ["ema1", "ema2", "signalPeriod"], "default": [12, 26, 9] },
            "GC": { "fields": ["ma1Period", "ma2Period"], "default": [15, 50] }
        }

        // for each indicator
        Object.keys(this.indicators).map((indicatorName, index) => {
            // initialize global state with default values
            this.indicators[indicatorName]["fields"].map((field, index) => {
                this.props.setIndicatorOption(indicatorName, field, this.indicators[indicatorName]["default"][index]);
            })
        })
    }

    render() {
        let activeIndicators = [...this.props.activeIndicators];
        return (
            <div className="indicators">
                <h1>Indicators</h1>
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
    return { indicatorOptions: state.indicatorOptions, activeIndicators: state.activeIndicators };
};

export default connect(mapStateToProps, { setIndicatorOption, setIndicatorOn, setID })(Indicators);
