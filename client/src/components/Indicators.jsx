import React, { createRef } from 'react';
import './Indicators.css';
import caret from "../arrow.svg";

class Indicators extends React.Component {
    constructor(props) {
        super(props);
        this.indicators = [{ name: "SMA", fields: ["period"] },
        { name: "RSI", fields: ["period", "underbought", "overbought"] },
        { name: "MACD", fields: ["ema1", "ema2", "signalPeriod"] }];
        this.indicatorStatus = {};
        this.indicatorOptions = {};
    }

    // when edit indicator fields
    setIndicatorOptions = (indicator, field, value) => {
        // set options
        if (!this.indicatorOptions.hasOwnProperty(indicator)) {
            this.indicatorOptions[indicator] = {};
        }
        this.indicatorOptions[indicator][field] = value;

        // find all enabled options
        let enabledIndicators = {}
        Object.keys(this.indicatorOptions).forEach(i => {
            // if indicator is enabled, add it to the enabled options
            if (this.indicatorStatus.hasOwnProperty(i) && this.indicatorStatus[i]){
                enabledIndicators[i] = this.indicatorOptions[i];
            }
        })

        // passes information to parent
        this.props.setIndicatorOptions(enabledIndicators);
    }

    // when edit indicator checkbox changed
    setIndicatorUsed = (indicator, checked) => {
        this.indicatorStatus[indicator] = checked;

        // find all enabled options
        let enabledIndicators = {}
        Object.keys(this.indicatorOptions).forEach(i => {
            // if indicator is enabled, add it to the enabled options
            if (this.indicatorStatus.hasOwnProperty(i) && this.indicatorStatus[i]){
                enabledIndicators[i] = this.indicatorOptions[i];
            }
        })

        // passes information to parent
        this.props.setIndicatorOptions(enabledIndicators);
    }

    render() {
        return (
            <div className="indicators">
                <span className="indicators-title">Indicators</span>
                <div className="indicators-list">
                    {this.indicators.map((indicator, index) => {
                        return <Indicator name={indicator["name"]} fields={indicator["fields"]} key={index}
                            setIndicatorOptions={this.setIndicatorOptions} setIndicatorUsed={this.setIndicatorUsed} />
                    })}
                </div>
            </div>
        );
    }
}

class Indicator extends React.Component {
    /*
        "SMA": { "period": 9 },
        "RSI": { "period": 14, "underbought": 30, "overbought": 70 },
        "MACD": { "ema1": 12, "ema2": 26, "signalPeriod": 9 },
    */

    state = { showFields: false };

    toggleFields = () => {
        this.setState({ showFields: !this.state.showFields });
    }

    render() {
        return (<div className="indicator">
            <div className="indicator-header">
                <input className="indicator-box" type="checkbox" name={this.props.name} value={this.props.name} onChange={(e) => { this.props.setIndicatorUsed(this.props.name, e.target.checked) }} />
                <span className="indicator-text">{this.props.name}</span>
                <img className={`indicator-caret${this.state.showFields ? " indicator-show" : ""}`} width="10px" height="10px" src={caret} alt="Arrow" onClick={this.toggleFields} />
            </div>
            <div className={`indicator-fields${this.state.showFields ? " indicator-show" : ""}`}>
                {
                    this.props.fields.map((field, index) => {
                        return (<div key={index}>
                            <label>{field}:</label>
                            <input type="number" name={field} onChange={(e) => { this.props.setIndicatorOptions(this.props.name, field, parseFloat(e.target.value)) }} />
                        </div>);
                    })
                }
            </div>
        </div>);
    }
}

export default Indicators;
