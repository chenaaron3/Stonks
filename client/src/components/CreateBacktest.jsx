import React, { createRef } from 'react';
import "./CreateBacktest.css";
import { connect } from 'react-redux';
import { setIndicatorOption, setIndicatorOn, setID, clearIndicators, setSavedResults, setBacktestResults, viewStock } from '../redux';
import Stepper from 'react-stepper-horizontal';
import Indicator from './Indicator';
import Pusher from 'react-pusher';

class CreateBacktest extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            step: 0,
            mainBuyIndicator: "",
            mainSelIndicator: "",
            buyOptions: {},
            sellOptions: {}
        };
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
            // "stopLoss": .5,
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
            this.setState({ step: this.state.step + 1 });
        }
    }

    setStep = (step) => {
        this.setState({ step });
    }

    // when server signals that the results are ready
    onResultFinished = async (data) => {
        let id = data["id"];
        // get the results from database
        let results = await this.fetchBacktestResults(id);
        // store results in global state
        this.props.setBacktestResults(id, results);

        // TODO tell user that results are ready
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
                        <Stepper defaultTitleColor="#ecf0f1" activeTitleColor="#ecf0f1" completeTitleColor="#ecf0f1"
                            steps={[{ title: 'Set Buy Criterias', onClick: (e) => { e.preventDefault(); this.setStep(0) } },
                            { title: "Set Sell Criterias", onClick: (e) => { e.preventDefault(); this.setStep(1) } },
                            { title: "Start Backtest!", onClick: (e) => { e.preventDefault(); this.setStep(2) } }]} activeStep={this.state.step} />
                    </div>

                    <div className="create-backtest-form-body">
                        {
                            this.state.step == 0 && (
                                <>
                                    <h2 className="create-backtest-form-body-title">Customize your buy criterias.</h2>
                                    <h3>Select buy indicators to identify entry signals.</h3>
                                    <div className="create-backtest-indicator-list">
                                        {Object.keys(this.indicators).map((indicatorName, index) => {
                                            return <Indicator name={indicatorName} fields={this.indicators[indicatorName]["fields"]} default={this.indicators[indicatorName]["default"]} key={index}
                                                setIndicatorOption={this.props.setIndicatorOption} setIndicatorOn={this.props.setIndicatorOn} active={activeIndicators.includes(indicatorName)}
                                                options={this.props.indicatorOptions[indicatorName]} />
                                        })}
                                    </div>
                                    <h3>Select a main buy indicator to initiate buy events.</h3>
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
                                    <h2 className="create-backtest-form-body-title">Customize your sell criterias.</h2>
                                    <h3>Select sell indicators to identify exit signals.</h3>
                                    <div className="create-backtest-indicator-list">
                                        {Object.keys(this.indicators).map((indicatorName, index) => {
                                            return <Indicator name={indicatorName} fields={this.indicators[indicatorName]["fields"]} default={this.indicators[indicatorName]["default"]} key={index}
                                                setIndicatorOption={this.props.setIndicatorOption} setIndicatorOn={this.props.setIndicatorOn} active={activeIndicators.includes(indicatorName)}
                                                options={this.props.indicatorOptions[indicatorName]} />
                                        })}
                                    </div>
                                    <h3>Select a main sell indicator to initiate a sell events.</h3>
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
                                    <h2 className="create-backtest-form-body-title">Confirm your strategy.</h2>
                                    <h3>Buy Criterias:</h3>
                                    <p>Main Indicator: {this.state.mainBuyIndicator}</p>
                                    <p>Indicators: {JSON.stringify(this.state.buyOptions)}</p>
                                    <h3>Sell Criterias:</h3>
                                    <p>Indicators: {JSON.stringify(this.state.sellOptions)}</p>
                                    <p>Main Indicator: {this.state.mainSellIndicator}</p>
                                </>
                            )
                        }

                        <button className="create-backtest-start-button" onClick={this.state.step < 2 ? this.nextStep : this.getResults}>
                            <span className="create-backtest-start-text">{this.state.step < 2 ? "Next" : "Get Results"}</span>
                        </button>
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