import React, { createRef } from 'react';
import './Indicators.css';
import caret from "../arrow.svg";
import { connect } from 'react-redux';
import { setIndicatorOption, setIndicatorOn, setID } from '../redux';
import { NeuButton } from 'neumorphism-react';
import Stepper from 'react-stepper-horizontal';

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

    setMainIndicator = (isBuy, indicator) => {
        if (isBuy) {
            this.setState({ mainBuyIndicator: indicator });
        } else {
            this.setState({ mainSellIndicator: indicator });
        }
    }

    getResults = () => {
        let finalOptions = {};
        this.props.activeIndicators.forEach(activeIndicator => {
            finalOptions[activeIndicator] = this.props.indicatorOptions[activeIndicator];
        });
        let strategyOptions = {
            indicators: finalOptions,
            "mainBuyIndicator": this.state.mainBuyIndicator,
            "mainSellIndicator": this.state.mainSellIndicator,
            // "stopLoss": .5,
            "minVolume": 1000000,
            "expiration": 7,
            "multipleBuys": true
        };

        // fetch("/fakeBacktest?id=T3IhpLe6bS")
        //     .then(res => res.json())
        //     .then(results => {
        //         let id = results["id"];
        //         console.log(`Getting id ${id} from server!`);
        //         this.props.setID(id);
        //     });

        // fetch results here        
        fetch("/backtest", {
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

    nextStep = () => {
        // error checking
        if (this.state.step == 0 && this.props.activeIndicators.size == 0) {
            alert("Please select at least one indicator.");
            return;
        }
        else if (this.state.step == 1) {
            if (this.state.mainBuyIndicator == "") {
                alert("Please select a main buy indicator.");
                return;
            }
            if (this.state.mainSellIndicator == "") {
                alert("Please select a main sell indicator.");
                return;
            }
        }
        if (this.state.step < 2) {
            this.setState({ step: this.state.step + 1 });
        }
    }

    setStep = (step) => {
        this.setState({ step });
    }

    render() {
        let activeIndicators = [...this.props.activeIndicators];
        return (
            <div className="indicators">
                <Stepper steps={[{ title: 'Select Indicators', onClick: (e) => { e.preventDefault(); this.setStep(0) } },
                { title: "Choose Main Indicators", onClick: (e) => { e.preventDefault(); this.setStep(1) } },
                { title: "Start Backtest!", onClick: (e) => { e.preventDefault(); this.setStep(2) } }]} activeStep={this.state.step} />
                {this.state.step == 0 && (
                    <div className="indicators-list">
                        {Object.keys(this.indicators).map((indicatorName, index) => {
                            return <Indicator name={indicatorName} fields={this.indicators[indicatorName]["fields"]} default={this.indicators[indicatorName]["default"]} key={index}
                                setIndicatorOption={this.props.setIndicatorOption} setIndicatorOn={this.props.setIndicatorOn} active={activeIndicators.includes(indicatorName)}
                                options={this.props.indicatorOptions[indicatorName]} />
                        })}
                    </div>
                )}
                {
                    this.state.step == 1 && (
                        <div className="indicators-list">
                            <div className="indicators-subtitle">Select a Main Buy Indicator</div>
                            {activeIndicators.map((indicatorName, index) => {
                                return <MainIndicatorOption name={indicatorName} isChecked={this.state.mainBuyIndicator == indicatorName} key={index}
                                    setMainIndicator={this.setMainIndicator} isBuy={true} />
                            })}
                            <div className="indicators-subtitle">Select a Main Sell Indicator</div>
                            {activeIndicators.map((indicatorName, index) => {
                                return <MainIndicatorOption name={indicatorName} isChecked={this.state.mainSellIndicator == indicatorName} key={index}
                                    setMainIndicator={this.setMainIndicator} isBuy={false} />
                            })}
                        </div>
                    )
                }
                <NeuButton className="indicators-start-button" width="7vw" height="6vh" color="#E0E5EC" distance={3} onClick={this.state.step < 2 ? this.nextStep : this.getResults}>
                    <span className="indicators-start-text">{this.state.step < 2 ? "Next" : "Get Results"}</span>
                </NeuButton>
            </div>
        );
    }
}

class MainIndicatorOption extends React.Component {
    setMainIndicator = () => {
        this.props.setMainIndicator(this.props.isBuy, this.props.name);
    }

    render() {
        return <div className="indicator-header">
            <input className="indicator-box" type="radio" checked={this.props.isChecked} name={`main${this.props.isBuy ? "Buy" : "Sell"}`} value={this.props.name}
                onChange={(e) => { this.setMainIndicator() }} />
            <span className="indicator-text">{this.props.name}</span>
        </div>
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
                <input className="indicator-box" type="checkbox" checked={this.props.active} name={this.props.name} value={this.props.name} onChange={(e) => { this.props.setIndicatorOn(this.props.name, e.target.checked) }} />
                <span className="indicator-text">{this.props.name}</span>
                <img className={`indicator-caret${this.state.showFields ? " indicator-show" : ""}`} width="10px" height="10px" src={caret} alt="Arrow" onClick={this.toggleFields} />
            </div>
            <div className={`indicator-fields${this.state.showFields ? " indicator-show" : ""}`}>
                {
                    this.props.fields.map((field, index) => {
                        // use options if exists, else use default
                        let value = (this.props.options && this.props.options.hasOwnProperty(field)) ? this.props.options[field] : this.props.default[index];
                        return (<div key={index}>
                            <label>{field}:</label>
                            <input type="number" name={field} value={value} onChange={(e) => { this.props.setIndicatorOption(this.props.name, field, parseFloat(e.target.value)) }} />
                        </div>);
                    })
                }
            </div>
        </div>);
    }
}

let mapStateToProps = (state) => {
    console.log("NEW STATE:", state);
    return { indicatorOptions: state.indicatorOptions, activeIndicators: state.activeIndicators };
};

export default connect(mapStateToProps, { setIndicatorOption, setIndicatorOn, setID })(Indicators);
