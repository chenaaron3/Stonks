import React, { createRef } from 'react';
import './Indicators.css';
import caret from "../arrow.svg";

class Indicators extends React.Component {
    constructor(props) {
        super(props);
        this.indicators = [{ name: "SMA", fields: ["period"] },
        { name: "RSI", fields: ["period", "underbought", "overbought"] },
        { name: "MACD", fields: ["ema1", "ema2", "signalPeriod"] }];
    }

    render() {
        return (
            <div className="indicators">
                <span className="indicators-title">Indicators</span>
                <div className="indicators-list">
                    {this.indicators.map((indicator, index) => {
                        return <Indicator name={indicator["name"]} fields={indicator["fields"]} key={index} />
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
        console.log("HI!");
        this.setState({ showFields: !this.state.showFields });
    }

    render() {
        return (<div className="indicator">
            <div className="indicator-header">
                <input className="indicator-box" type="checkbox" name={this.props.name} value={this.props.name} />
                <span className="indicator-text">{this.props.name}</span>
                <img className={`indicator-caret${this.state.showFields ? " indicator-show" : ""}`} width="10px" height="10px" src={caret} alt="Arrow" onClick={this.toggleFields} />
            </div>
            <div className={`indicator-fields${this.state.showFields ? " indicator-show" : ""}`}>
                {
                    this.props.fields.map((field, index) => {
                        return (<div key={index}>
                            <label>{field}:</label>
                            <input type="text" name={field} />
                        </div>);
                    })
                }
            </div>
        </div>);
    }
}

export default Indicators;
