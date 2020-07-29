import React, { createRef } from 'react';
import './Indicators.css';
import caret from "../arrow.svg";
import { connect } from 'react-redux';
import { setIndicatorOption, setIndicatorOn, setID } from '../redux';
import { NeuButton } from 'neumorphism-react';

class Indicators extends React.Component {
    constructor(props) {
        super(props);
        this.indicators = [{ name: "SMA", fields: ["period"] },
        { name: "RSI", fields: ["period", "underbought", "overbought"] },
        { name: "MACD", fields: ["ema1", "ema2", "signalPeriod"] }];
    }

    getResults = () => {
        let finalOptions = {};
        this.props.activeIndicators.forEach(activeIndicator => {
            finalOptions[activeIndicator] = this.props.indicatorOptions[activeIndicator];
        });
        let strategyOptions = {
            indicators: finalOptions,
            "mainBuyIndicator": "RSI",
            "mainSellIndicator": "RSI",
            "minVolume": 1000000,
            "expiration": 7,
            "multipleBuys": true
        };

        // fetch results here
        fetch("/intersections", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(strategyOptions)
        })
            .then(res => res.json())
            .then(results => {
                let id = results["id"];
                console.log(`Getting id ${id} from server!`);
                this.props.setID(id);
            });
    }

    render() {
        return (
            <div className="indicators">
                <span className="indicators-title">Indicators</span>
                <div className="indicators-list">
                    {this.indicators.map((indicator, index) => {
                        return <Indicator name={indicator["name"]} fields={indicator["fields"]} key={index}
                            setIndicatorOption={this.props.setIndicatorOption} setIndicatorOn={this.props.setIndicatorOn} />
                    })}
                </div>
                <NeuButton className="indicators-start-button" width="7vw" height="6vh" color="#E0E5EC" distance={3} onClick={this.getResults}>
                    <span className="indicators-start-text">Get Results!</span>
                </NeuButton>
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
                <input className="indicator-box" type="checkbox" name={this.props.name} value={this.props.name} onChange={(e) => { this.props.setIndicatorOn(this.props.name, e.target.checked) }} />
                <span className="indicator-text">{this.props.name}</span>
                <img className={`indicator-caret${this.state.showFields ? " indicator-show" : ""}`} width="10px" height="10px" src={caret} alt="Arrow" onClick={this.toggleFields} />
            </div>
            <div className={`indicator-fields${this.state.showFields ? " indicator-show" : ""}`}>
                {
                    this.props.fields.map((field, index) => {
                        return (<div key={index}>
                            <label>{field}:</label>
                            <input type="number" name={field} onChange={(e) => { this.props.setIndicatorOption(this.props.name, field, parseFloat(e.target.value)) }} />
                        </div>);
                    })
                }
            </div>
        </div>);
    }
}

let mapStateToProps = (state) => {
    console.log(state);
    return { indicatorOptions: state.indicatorOptions, activeIndicators: state.activeIndicators };
};

export default connect(mapStateToProps, { setIndicatorOption, setIndicatorOn, setID })(Indicators);
