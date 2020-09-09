import React, { createRef } from 'react';
import "./CreateBacktest.css";
import { connect } from 'react-redux';
import { setIndicatorOption, setIndicatorOn, setID, clearIndicators, setSavedResults, setBacktestResults, viewStock } from '../redux';
import Stepper from 'react-stepper-horizontal';
import Indicator from './Indicator';
import Pusher from 'react-pusher';
import stock from '../stock.svg';
import money from '../money.svg';
import start from '../start.svg';

class CreateBacktest extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            step: 0,
            mainBuyIndicator: "",
            mainSelIndicator: "",
            buyOptions: {},
            sellOptions: {},
            stopLossHigh: 1,
        };
        this.indicators = {
            "SMA": { "fields": ["period", "minDuration"], "default": [180, 3] },
            "EMA": { "fields": ["period", "minDuration"], "default": [5, 3] },
            "RSI": { "fields": ["period", "underbought", "overbought"], "default": [14, 30, 70] },
            "MACD": { "fields": ["ema1", "ema2", "signalPeriod"], "default": [12, 26, 9] },
            "GC": { "fields": ["ma1Period", "ma2Period"], "default": [15, 50] },
            "ADX": { "fields": ["period"], "default": [12] },
            "Solid": { "fields": ["minLength", "maxRatio"], "default": [2, .1] }
        }

        // for each indicator
        Object.keys(this.indicators).map((indicatorName, index) => {
            // initialize global state with default values
            this.indicators[indicatorName]["fields"].map((field, index) => {
                this.props.setIndicatorOption(indicatorName, field, this.indicators[indicatorName]["default"][index]);
            })
        })
    }

    // sets the main buy/sell indicator
    setMainIndicator = (isBuy, indicator) => {
        if (isBuy) {
            this.setState({ mainBuyIndicator: indicator });
        } else {
            this.setState({ mainSellIndicator: indicator });
        }
    }

    // get the final indicator options to pass into api
    deriveIndicatorOptions = () => {
        // construct final strategy options
        let finalOptions = {};
        this.props.activeIndicators.forEach(activeIndicator => {
            finalOptions[activeIndicator] = this.props.indicatorOptions[activeIndicator];
        });
        return finalOptions;
    }

    // get results from api
    getResults = () => {
        let strategyOptions = {
            "buyIndicators": this.state.buyOptions,
            "sellIndicators": this.state.sellOptions,
            "mainBuyIndicator": this.state.mainBuyIndicator,
            "mainSellIndicator": this.state.mainSellIndicator,
            // "stopLossLow": .98,
            "stopLossHigh": this.state.stopLossHigh == 1 ? undefined : this.state.stopLossHigh,
            "minVolume": 1000000,
            "expiration": 7,
            "multipleBuys": true
        };

        // fetch("/fakeBacktest?id=p9GPvWKBA6")
        //     .then(res => res.json())
        //     .then(results => {
        //         let id = results["id"];
        //         console.log(`Getting id ${id} from server!`);
        //         this.props.setID(id);
        //     });

        // fetch results here        
        fetch(`${process.env.REACT_APP_SUBDIRECTORY}/backtest`, {
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

                // cache id immediately
                let indicatorsUsed = new Set();
                Object.keys(this.state.buyOptions).forEach(i => indicatorsUsed.add(i));
                Object.keys(this.state.sellOptions).forEach(i => indicatorsUsed.add(i));
                indicatorsUsed = [...indicatorsUsed];
                indicatorsUsed.sort();
                let displayName = indicatorsUsed.join("/");

                // save the results
                let newSave = [...this.props.savedResults, { id, display: displayName }];
                this.props.setSavedResults(newSave);
                localStorage.setItem("savedResults", JSON.stringify(newSave));
            });
    }

    previousStep = () => {
        this.setStep(this.state.step - 1);
    }

    // error checking
    nextStep = () => {
        if (this.state.step == 0) {
            if (this.state.mainBuyIndicator == "" || !this.props.activeIndicators.has(this.state.mainBuyIndicator)) {
                alert("Please select a main buy indicator.");
                return;
            }
            this.setState({ buyOptions: this.deriveIndicatorOptions() });
        }
        else if (this.state.step == 1) {
            if (this.state.mainSellIndicator == "" || !this.props.activeIndicators.has(this.state.mainSellIndicator)) {
                alert("Please select a main sell indicator.");
                return;
            }
            this.setState({ sellOptions: this.deriveIndicatorOptions() });
        }
        if (this.state.step < 2) {
            this.setStep(this.state.step + 1);
        }
    }

    setStep = (step) => {
        // prefill previous form data
        if (step == 0) {
            // sets options
            Object.keys(this.state.buyOptions).forEach(indicatorName => {
                Object.keys(this.state.buyOptions[indicatorName]).forEach(field => {
                    this.props.setIndicatorOption(indicatorName, field, this.state.buyOptions[indicatorName][field]);
                })
            })
            // sets on/off
            Object.keys(this.indicators).forEach(indicatorName => {
                this.props.setIndicatorOn(indicatorName, this.state.buyOptions.hasOwnProperty(indicatorName));
            })
        }
        if (step == 1) {
            // sets options
            Object.keys(this.state.sellOptions).forEach(indicatorName => {
                Object.keys(this.state.sellOptions[indicatorName]).forEach(field => {
                    this.props.setIndicatorOption(indicatorName, field, this.state.sellOptions[indicatorName][field]);
                })
            })
            // sets on/off
            Object.keys(this.indicators).forEach(indicatorName => {
                this.props.setIndicatorOn(indicatorName, this.state.sellOptions.hasOwnProperty(indicatorName));
            })
        }
        this.setState({ step });
    }

    // when server signals that the results are ready
    onResultFinished = async (data) => {
        let id = data["id"];
        // get the results from database
        let results = await this.fetchBacktestResults(id);
        // store results in global state
        this.props.setBacktestResults(id, results);
    }

    fetchBacktestResults = (id) => {
        return new Promise(resolve => {
            // get the data from the server
            fetch(`${process.env.REACT_APP_SUBDIRECTORY}/results?id=${id}`, {
                method: 'GET'
            }).then(res => res.json())
                .then(results => {
                    resolve(results);
                });
        })
    }

    render() {
        let allIndicators = Object.keys(this.indicators);
        let activeIndicators = [...this.props.activeIndicators];
        activeIndicators.sort();
        return (
            <div className="create-backtest">
                <Pusher
                    channel={this.props.id}
                    event="onResultsFinished"
                    onUpdate={this.onResultFinished}
                />
                <h1 className="create-backtest-title">New Backtest</h1>

                <div className="create-backtest-form">
                    <div className="create-backtest-stepper">
                        <Stepper defaultTitleColor="#ecf0f1" activeTitleColor="#ecf0f1" completeTitleColor="#ecf0f1" completeColor="#90EE90" activeColor="#90EE90"
                            steps={[{ title: 'Buy Criterias', icon: stock, onClick: (e) => { e.preventDefault(); this.setStep(0) } },
                            { title: "Sell Criterias", icon: money, onClick: (e) => { e.preventDefault(); this.setStep(1) } },
                            { title: "Start Backtest", icon: start, onClick: (e) => { e.preventDefault(); this.setStep(2) } }]} activeStep={this.state.step} />
                    </div>

                    <div className="create-backtest-form-body">
                        <div className="create-backtest-form-body-content">
                            {
                                this.state.step == 0 && (
                                    <>
                                        {/* <h2 className="create-backtest-form-body-title">Customize your buy criterias.</h2> */}
                                        <h3 className="create-backtest-subtitle">Select buy indicators to identify entry signals.</h3>
                                        <div className="create-backtest-indicator-list">
                                            {Object.keys(this.indicators).map((indicatorName, index) => {
                                                return <Indicator name={indicatorName} fields={this.indicators[indicatorName]["fields"]} default={this.indicators[indicatorName]["default"]} key={index}
                                                    setIndicatorOption={this.props.setIndicatorOption} setIndicatorOn={this.props.setIndicatorOn} active={activeIndicators.includes(indicatorName)}
                                                    options={this.props.indicatorOptions[indicatorName]} />
                                            })}
                                        </div>
                                        <h3 className="create-backtest-subtitle">Select a main indicator to initiate buy events.</h3>
                                        <div className="create-backtest-main-indicator-list">
                                            {activeIndicators.length == 0 && (
                                                <p className="create-backtest-error">No indicators selected...</p>
                                            )}
                                            {activeIndicators.map((indicatorName, index) => {
                                                return <MainIndicatorOption name={indicatorName} isChecked={this.state.mainBuyIndicator == indicatorName} key={index}
                                                    setMainIndicator={this.setMainIndicator} isBuy={true} />
                                            })}
                                        </div>
                                    </>
                                )}
                            {
                                this.state.step == 1 && (
                                    <>
                                        {/* <h2 className="create-backtest-form-body-title">Customize your sell criterias.</h2> */}
                                        <h3 className="create-backtest-subtitle">Select sell indicators to identify exit signals.</h3>
                                        <div className="create-backtest-indicator-list">
                                            {Object.keys(this.indicators).map((indicatorName, index) => {
                                                return <Indicator name={indicatorName} fields={this.indicators[indicatorName]["fields"]} default={this.indicators[indicatorName]["default"]} key={index}
                                                    setIndicatorOption={this.props.setIndicatorOption} setIndicatorOn={this.props.setIndicatorOn} active={activeIndicators.includes(indicatorName)}
                                                    options={this.props.indicatorOptions[indicatorName]} />
                                            })}
                                        </div>
                                        <h3 className="create-backtest-subtitle">Select a main indicator to initiate a sell events.</h3>
                                        <div className="create-backtest-main-indicator-list">
                                            {activeIndicators.length == 0 && (
                                                <p className="create-backtest-error">No indicators selected...</p>
                                            )}
                                            {activeIndicators.map((indicatorName, index) => {
                                                return <MainIndicatorOption name={indicatorName} isChecked={this.state.mainSellIndicator == indicatorName} key={index}
                                                    setMainIndicator={this.setMainIndicator} isBuy={false} />
                                            })}
                                        </div>
                                    </>
                                )
                            }
                            {
                                this.state.step == 2 && (
                                    <>
                                        {/* <h2 className="create-backtest-form-body-title">Confirm your strategy.</h2> */}
                                        <div className="create-backtest-form-body-split">
                                            <div className="create-backtest-additional-options">
                                                <h3 className="create-backtest-subtitle">Additional Options</h3>
                                                <div>
                                                    <span>Take profit (20 to sell at 20% profit. 0 to disable.)</span><br />
                                                    <input type="number" onChange={(e) => {
                                                        this.setState({ stopLossHigh: 1 + parseFloat(e.target.value) / 100 })
                                                    }}></input>
                                                </div>
                                            </div>
                                            <div className="create-backtest-review-criterias">
                                                <h3 className="create-backtest-subtitle">Buy Criterias:</h3>
                                                <p>Main Indicator: {this.state.mainBuyIndicator}</p>
                                                <pre id="json">{JSON.stringify(this.state.buyOptions, null, 2).replace(/[{},"]/g, "")}</pre>
                                            </div>
                                            <div className="create-backtest-review-criterias">
                                                <h3 className="create-backtest-subtitle">Sell Criterias:</h3>
                                                <p>Main Indicator: {this.state.mainSellIndicator}</p>
                                                <pre id="json">{JSON.stringify(this.state.sellOptions, null, 2).replace(/[{},"]/g, "")}</pre>
                                            </div>
                                        </div>
                                    </>
                                )
                            }
                        </div>
                        <div className="create-backtest-actions">
                            {this.state.step != 0 && (
                                <button className="create-backtest-previous-button" onClick={this.previousStep}>
                                    <span className="create-backtest-start-text">Previous</span>
                                </button>)
                            }
                            {
                                this.state.step == 0 && <span></span>
                            }
                            <button className="create-backtest-start-button" onClick={this.state.step < 2 ? this.nextStep : this.getResults}>
                                <span className="create-backtest-start-text">{this.state.step < 2 ? "Next" : "Get Results"}</span>
                            </button>
                        </div>
                    </div>
                </div>
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

let mapStateToProps = (state) => {
    return { indicatorOptions: state.indicatorOptions, activeIndicators: state.activeIndicators, id: state.id, savedResults: state.savedResults };
};

export default connect(mapStateToProps, { setIndicatorOption, setIndicatorOn, setID, clearIndicators, setSavedResults, setBacktestResults, viewStock })(CreateBacktest);