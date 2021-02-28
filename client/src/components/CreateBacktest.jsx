import React, { createRef } from 'react';
import "./CreateBacktest.css";
import { connect } from 'react-redux';
import { setIndicatorOption, setIndicatorOn, setID, clearIndicators, setSavedResults, setBacktestResults, setDrawer } from '../redux';
import { getBacktestDisplayName } from '../helpers/utils'
// import Stepper from 'react-stepper-horizontal';
import Indicator from './Indicator';
import Pusher from 'react-pusher';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Checkbox from '@material-ui/core/Checkbox';
import FormControlLabel from '@material-ui/core/FormControlLabel';

import { makeStyles } from '@material-ui/core/styles';
import Stepper from '@material-ui/core/Stepper';
import Step from '@material-ui/core/Step';
import StepLabel from '@material-ui/core/StepLabel';
import MenuIcon from '@material-ui/icons/Menu';
import IconButton from '@material-ui/core/IconButton';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import MediaQuery from 'react-responsive'

class CreateBacktest extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            step: 0,
            mainBuyIndicator: "",
            mainSelIndicator: "",
            buyOptions: {},
            sellOptions: {},
            stopLossHigh: 0,
            stopLossLow: 0,
            stopLossAtr: 0,
            targetAtr: 0,
            riskRewardRatio: 0,
            limitOrder: false,
            trailingStopLoss: false,
            timeframe: "day",
            minVolume: 1000000,
            maxDays: 30,
            errors: {}
        };
        this.indicators = {
            "SMA": { "fields": ["period", "minDuration"], "default": [180, 1] },
            "EMA": { "fields": ["period", "minDuration"], "default": [5, 1] },
            "RSI": { "fields": ["period", "underbought", "overbought"], "default": [14, 30, 70] },
            "MACD": { "fields": ["ema1", "ema2", "signalPeriod"], "default": [12, 26, 9] },
            "Stochastic": { "fields": ["period", "underbought", "overbought"], "default": [14, 20, 80] },
            "ADX": { "fields": ["period", "threshold"], "default": [14, 20] },
            "Candle": { "fields": ["expiration"], "default": [0] },
            "MACD2": { "fields": ["ema1", "ema2", "signalPeriod", "buyThreshold"], "default": [12, 26, 9, -.01] },
            "Structure": { "fields": ["period", "volatility", "minCount"], "default": [75, .05, 1] },
            "Pullback": { "fields": ["period", "length"], "default": [180, 12] },
            "Divergence": { "fields": ["period", "lookback"], "default": [10, 3] },
            "Trend": { "fields": ["period", "lookback"], "default": [10, 1] },
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
        // secret pass for production
        if (process.env.NODE_ENV == "production") {
            let pass = prompt('Enter the secret code.');
            if (pass != "stonks") {
                return;
            }
        }

        // check for valid values
        let fieldsToCheck = ["stopLossLow", "stopLossHigh", "stopLossAtr", "targetAtr", "riskRewardRatio", "minVolume", "maxDays"];
        let numericalFields = {};
        let errors = {};
        let errored = false;
        for (let i = 0; i < fieldsToCheck.length; ++i) {
            let f = fieldsToCheck[i];
            let newValue = parseFloat(this.state[f]);
            // error fields
            if (typeof this.state[f] != "number" && !newValue) {
                errors[f] = true;
                numericalFields[f] = 0;
                errored = true;
            }
            else {
                errors[f] = false;
                numericalFields[f] = newValue;
            }
        }

        if (errored) {
            alert("Invalid fields");
            this.setState({ ...numericalFields, errors });
            return;
        }

        this.setState({ ...numericalFields, errors }, () => {
            // go back to first step as confirmation
            this.setStep(0);

            let strategyOptions = {
                "buyIndicators": this.state.buyOptions,
                "sellIndicators": this.state.sellOptions,
                "mainBuyIndicator": this.state.mainBuyIndicator,
                "mainSellIndicator": this.state.mainSellIndicator,
                "stopLossLow": this.state.stopLossLow == 0 ? undefined : 1 - this.state.stopLossLow / 100,
                "stopLossHigh": this.state.stopLossHigh == 0 ? undefined : 1 + this.state.stopLossHigh / 100,
                "stopLossAtr": this.state.stopLossAtr == 0 ? undefined : this.state.stopLossAtr,
                "targetAtr": this.state.targetAtr == 0 ? undefined : this.state.targetAtr,
                "riskRewardRatio": this.state.riskRewardRatio == 0 ? undefined : this.state.riskRewardRatio,
                "timeframe": this.state.timeframe,
                "stopLossSwing": this.state.stopLossSwing,
                "targetSwing": this.state.targetSwing,
                "limitOrder": this.state.limitOrder,
                "trailingStopLoss": this.state.trailingStopLoss,
                "minVolume": this.state.minVolume,
                "maxDays": this.state.maxDays,
                "expiration": 7,
                "multipleBuys": true
            };

            // fetch results here        
            fetch(`${process.env.NODE_ENV == "production" ? process.env.REACT_APP_SUBDIRECTORY : ""}/backtest`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(strategyOptions)
            })
                .then(res => res.json())
                .then(results => {
                    console.log("STATUS:", results["status"]);
                    setTimeout(() => { alert(results["status"]); }, 1000);

                    let id = results["id"];
                    console.log(`Getting id ${id} from server!`);
                    this.props.setID(id);

                    // cache id immediately
                    let displayName = getBacktestDisplayName(strategyOptions);

                    // save the results
                    let newSave = [...this.props.savedResults, { id, display: displayName }];
                    this.props.setSavedResults(newSave);
                    localStorage.setItem("savedResults", JSON.stringify(newSave));
                });
        })
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
            fetch(`${process.env.NODE_ENV == "production" ? process.env.REACT_APP_SUBDIRECTORY : ""}/results?id=${id}`, {
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

        let buyIndicators = JSON.stringify(this.state.buyOptions, null, 2).replace(/[{},"]/g, "");
        buyIndicators = buyIndicators.split("\n").filter(x => x.trim().length > 0).join("\n");
        let sellIndicators = JSON.stringify(this.state.sellOptions, null, 2).replace(/[{},"]/g, "");
        sellIndicators = sellIndicators.split("\n").filter(x => x.trim().length > 0).join("\n");

        return (
            <div className="create-backtest">
                <Pusher
                    channel={this.props.id}
                    event="onResultsFinished"
                    onUpdate={this.onResultFinished}
                />
                <MediaQuery maxWidth="600px">
                    <IconButton
                        aria-label="more"
                        aria-controls="long-menu"
                        aria-haspopup="true"
                        onClick={() => { this.props.setDrawer("left", true) }}
                        style={{ position: "absolute", top: "1vh", left: "1vh" }}
                    >
                        <MenuIcon />
                    </IconButton>
                </MediaQuery>
                <h1 className="create-backtest-title">New Backtest</h1>
                <div className="create-backtest-form">
                    <div className="create-backtest-stepper">
                        <Stepper alternativeLabel activeStep={this.state.step} style={{ width: "100%", height: "100%", backgroundColor: "#dee4ec" }}>
                            <Step>
                                <StepLabel>Buy Criterias</StepLabel>
                            </Step>
                            <Step>
                                <StepLabel>Sell Criterias</StepLabel>
                            </Step>
                            <Step>
                                <StepLabel>Start Backtest</StepLabel>
                            </Step>
                        </Stepper>
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
                                        <div className="create-backtest-form-body-split create-backtest-confirmation">
                                            <div>
                                                <h3 className="create-backtest-subtitle">Additional Options</h3>
                                                <div className="create-backtest-form-body-split">
                                                    <div className="create-backtest-additional-options">
                                                        <div>
                                                            <TextField label="Target Pips" value={this.state.stopLossHigh}
                                                                onChange={(e) => {
                                                                    this.setState({ stopLossHigh: e.target.value })
                                                                }}
                                                                helperText="20 to sell at 20% profit. 0 to disable."
                                                                error={this.state.errors["stopLossHigh"]} />
                                                        </div>
                                                        {/* <div>
                                                            <TextField label="Stop Loss" value={this.state.stopLossLow}
                                                            onChange={(e) => {
                                                                let newValue = parseFloat(e.target.value);
                                                                if (!newValue) newValue = 0;
                                                                this.setState({ stopLossLow: newValue })
                                                            }} helperText="20 to sell at 20% loss. 0 to disable." />
                                                        </div> */}
                                                        <div>
                                                            <TextField label="Stop Loss ATR" value={this.state.stopLossAtr}
                                                                onChange={(e) => {
                                                                    this.setState({ stopLossAtr: e.target.value })
                                                                }}
                                                                helperText="1 to sell at 1 ATR below. 0 to disable."
                                                                error={this.state.errors["stopLossAtr"]} />
                                                        </div>
                                                        <div>
                                                            <TextField label="Minimum Volume" value={this.state.minVolume}
                                                                onChange={(e) => {
                                                                    this.setState({ minVolume: e.target.value })
                                                                }}
                                                                helperText="Buy if above volume."
                                                                error={this.state.errors["minVolume"]} />
                                                        </div>
                                                        <div>
                                                            <FormControl >
                                                                <InputLabel>Timeframe</InputLabel>
                                                                <Select
                                                                    value={this.state.timeframe}
                                                                    onChange={(e) => {
                                                                        this.setState({ timeframe: e.target.value })
                                                                    }}
                                                                >
                                                                    <MenuItem value={"day"}>Day</MenuItem>
                                                                    <MenuItem value={"15Min"}>15 Minutes</MenuItem>
                                                                </Select>
                                                            </FormControl>
                                                        </div>
                                                        <div>
                                                            <FormControlLabel
                                                                control={
                                                                    <Checkbox
                                                                        checked={this.state.targetSwing}
                                                                        onChange={(e) => {
                                                                            this.setState({ targetSwing: e.target.checked });
                                                                        }}
                                                                        color="primary"
                                                                    />
                                                                }
                                                                label="Stop Above Swing High"
                                                            />
                                                        </div>
                                                        <div>
                                                            <FormControlLabel
                                                                control={
                                                                    <Checkbox
                                                                        checked={this.state.stopLossSwing}
                                                                        onChange={(e) => {
                                                                            this.setState({ stopLossSwing: e.target.checked });
                                                                        }}
                                                                        color="primary"
                                                                    />
                                                                }
                                                                label="Stop Below Swing Low"
                                                            />
                                                        </div>
                                                        <div>
                                                            <FormControlLabel
                                                                control={
                                                                    <Checkbox
                                                                        checked={this.state.limitOrder}
                                                                        onChange={(e) => {
                                                                            this.setState({ limitOrder: e.target.checked });
                                                                        }}
                                                                        color="primary"
                                                                    />
                                                                }
                                                                label="Use Limit Order"
                                                            />
                                                        </div>
                                                        <div>
                                                            <FormControlLabel
                                                                control={
                                                                    <Checkbox
                                                                        checked={this.state.trailingStopLoss}
                                                                        onChange={(e) => {
                                                                            this.setState({ trailingStopLoss: e.target.checked });
                                                                        }}
                                                                        color="primary"
                                                                    />
                                                                }
                                                                label="Use Trailing Stop"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="create-backtest-additional-options">
                                                        <div>
                                                            <TextField label="Target ATR" value={this.state.targetAtr}
                                                                onChange={(e) => {
                                                                    this.setState({ targetAtr: e.target.value })
                                                                }}
                                                                helperText="1 to sell at 1 ATR above. 0 to disable."
                                                                error={this.state.errors["targetAtr"]} />
                                                        </div>
                                                        <div>
                                                            <TextField label="Risk Reward Ratio" value={this.state.riskRewardRatio}
                                                                onChange={(e) => {
                                                                    this.setState({ riskRewardRatio: e.target.value })
                                                                }}
                                                                helperText="2 for 2:1 ratio. 0 to disable."
                                                                error={this.state.errors["riskRewardRatio"]} />
                                                        </div>
                                                        <div>
                                                            <TextField label="Max Days" value={this.state.maxDays}
                                                                onChange={(e) => {
                                                                    this.setState({ maxDays: e.target.value })
                                                                }}
                                                                helperText="Sell if held longer than max days."
                                                                error={this.state.errors["maxDays"]} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="create-backtest-review-criterias">
                                                <h3 className="create-backtest-subtitle">Buy Criterias:</h3>
                                                <p>Main Indicator: {this.state.mainBuyIndicator}</p>
                                                <pre id="json" style={{ fontSize: "1em" }}>{buyIndicators}</pre>
                                            </div>
                                            <div className="create-backtest-review-criterias">
                                                <h3 className="create-backtest-subtitle">Sell Criterias:</h3>
                                                <p>Main Indicator: {this.state.mainSellIndicator}</p>
                                                <pre id="json" style={{ fontSize: "1em" }}>{sellIndicators}</pre>
                                            </div>
                                        </div>
                                    </>
                                )
                            }
                        </div>
                        <div className="create-backtest-actions">
                            <Button variant="contained" onClick={this.previousStep} color="primary" disabled={this.state.step == 0}>
                                Previous
                            </Button>
                            <Button variant="contained" onClick={this.state.step < 2 ? this.nextStep : this.getResults} color="primary">
                                {this.state.step < 2 ? "Next" : "Get Results"}
                            </Button>
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

export default connect(mapStateToProps, { setIndicatorOption, setIndicatorOn, setID, clearIndicators, setSavedResults, setBacktestResults, setDrawer })(CreateBacktest);