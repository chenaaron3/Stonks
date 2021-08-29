import React, { useState, useEffect } from 'react';
import './CreateBacktest.css';
import { getBacktestDisplayName } from '../helpers/utils'
import Indicator from './Indicator';
import Pusher from 'react-pusher';
import { postEndpoint, fetchBacktestResults } from '../helpers/api';

import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Checkbox from '@material-ui/core/Checkbox';
import FormControlLabel from '@material-ui/core/FormControlLabel';
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

import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { setBacktestResults, setBacktestID } from '../redux/slices/backtestSlice';
import { setSavedResults } from '../redux/slices/userSlice';
import { setDrawer } from '../redux/slices/uiSlice';
import { setIndicatorOption, setIndicatorOn, clearIndicators } from '../redux/slices/indicatorSlice';

import IndicatorType from '../types/indicator';
import Backtest from '../types/backtest';
import { Timeframe } from '../types/common';
import API from '../types/api';

const CreateBacktest: React.FC = (props) => {
    const dispatch = useAppDispatch();

    // Component State
    const [step, setStateStep] = useState(0);
    const [mainBuyIndicator, setMainBuyIndicator] = useState<IndicatorType.IndicatorNames | ''>('');
    const [mainSellIndicator, setMainSellIndicator] = useState<IndicatorType.IndicatorNames | ''>('');
    const [buyOptions, setBuyOptions] = useState<IndicatorType.Indicators>({});
    const [sellOptions, setSellOptions] = useState<IndicatorType.Indicators>({});
    const [stopLossAtr, setStopLossAtr] = useState('0');
    const [riskRewardRatio, setRiskRewardRatio] = useState('0');
    const [highPeriod, setHighPeriod] = useState('0');
    const [minVolume, setMinVolume] = useState('1000000');
    const [maxDays, setMaxDays] = useState('30');
    const [limitOrder, setLimitOrder] = useState(false);
    const [trailingStopLoss, setTrailingStopLoss] = useState(false);
    const [stoplossSwing, setStoplossSwing] = useState(false);
    const [timeframe, setTimeframe] = useState('1Day');
    const [errors, setErrors] = useState<{ [Property in keyof ErrorCheckFields]?: boolean }>({});

    // Global State
    const id = useAppSelector(state => state.backtest.id);
    const indicatorOptions = useAppSelector(state => state.indicator.options);
    const activeIndicators = useAppSelector(state => state.indicator.actives);
    const savedResults = useAppSelector(state => state.user.savedResults);

    interface IndicatorFieldDefinition {
        [key: string]: {
            fields: string[];
            default: number[];
        }
    }

    const indicators = {
        'SMA': { 'fields': ['period', 'minDuration'], 'default': [180, 1] },
        'EMA': { 'fields': ['period', 'minDuration'], 'default': [5, 1] },
        'RSI': { 'fields': ['period', 'underbought', 'overbought'], 'default': [14, 30, 70] },
        'MACD': { 'fields': ['ema1', 'ema2', 'signalPeriod'], 'default': [12, 26, 9] },
        'Stochastic': { 'fields': ['period', 'underbought', 'overbought'], 'default': [14, 20, 80] },
        'ADX': { 'fields': ['period', 'threshold'], 'default': [14, 20] },
        'Candle': { 'fields': ['expiration'], 'default': [0] },
        'MACD2': { 'fields': ['ema1', 'ema2', 'signalPeriod', 'buyThreshold'], 'default': [12, 26, 9, -.01] },
        'Structure': { 'fields': ['period', 'volatility', 'minCount'], 'default': [75, .05, 1] },
        'Pullback': { 'fields': ['period', 'length'], 'default': [180, 12] },
        'Divergence': { 'fields': ['period', 'lookback'], 'default': [10, 3] },
        'Trend': { 'fields': ['period', 'lookback'], 'default': [10, 1] },
    } as IndicatorFieldDefinition;

    interface ErrorCheckFields {
        'stopLossAtr': ErrorCheckField;
        'riskRewardRatio': ErrorCheckField;
        'minVolume': ErrorCheckField;
        'maxDays': ErrorCheckField;
        'highPeriod': ErrorCheckField;
    }

    type ErrorCheckField = { get: string, set: React.Dispatch<React.SetStateAction<string>> };

    let lookup = {
        'stopLossAtr': { get: stopLossAtr, set: setStopLossAtr },
        'riskRewardRatio': { get: riskRewardRatio, set: setRiskRewardRatio },
        'minVolume': { get: minVolume, set: setMinVolume },
        'maxDays': { get: maxDays, set: setMaxDays },
        'highPeriod': { get: highPeriod, set: setHighPeriod }
    } as ErrorCheckFields;

    useEffect(() => {
        Object.keys(indicators).map((indicatorName, index) => {
            // initialize global state with default values
            indicators[indicatorName]['fields'].map((field, index) => {
                dispatch(setIndicatorOption({
                    indicatorName: indicatorName as IndicatorType.IndicatorNames,
                    field,
                    value: indicators[indicatorName]['default'][index]
                }));
            })
        })
    }, [])

    // sets the main buy/sell indicator
    const setMainIndicator = (isBuy: boolean, indicator: IndicatorType.IndicatorNames) => {
        if (isBuy) {
            setMainBuyIndicator(indicator);
        } else {
            setMainSellIndicator(indicator);
        }
    }

    // get the final indicator options to pass into api
    const deriveIndicatorOptions = () => {
        // construct final strategy options
        let finalOptions: { [key: string]: IndicatorType.IndicatorParams } = {};
        activeIndicators.forEach(activeIndicator => {
            finalOptions[activeIndicator] = indicatorOptions[activeIndicator];
        });
        return finalOptions;
    }

    // get results from api
    const getResults = () => {
        // secret pass for production
        if (process.env.NODE_ENV == 'production') {
            let pass = prompt('Enter the secret code.');
            if (pass != 'stonks') {
                return;
            }
        }

        // check for valid values
        let fieldsToCheck = Object.keys(lookup) as (keyof ErrorCheckFields)[];
        let numericalFields = {} as { [Property in keyof ErrorCheckFields]: number };
        let errors = {} as { [Property in keyof ErrorCheckFields]: boolean };
        let errored = false;
        for (let i = 0; i < fieldsToCheck.length; ++i) {
            let f = fieldsToCheck[i];
            let newValue = parseFloat(lookup[f]['get']);
            // error fields
            if (typeof lookup[f] != 'number' && !newValue && newValue != 0) {
                errors[f] = true;
                numericalFields[f] = 0;
                errored = true;
            }
            else {
                errors[f] = false;
                numericalFields[f] = newValue;
            }
        }

        // update errors and fields
        setErrors(errors);
        for (let i = 0; i < fieldsToCheck.length; ++i) {
            let f = fieldsToCheck[i];
            lookup[f]['set'](numericalFields[f].toString());
        }

        if (errored) {
            alert('Invalid fields');
            return;
        }

        // go back to first step as confirmation
        setStep(0);

        let strategyOptions = {
            'buyIndicators': buyOptions,
            'sellIndicators': sellOptions,
            'mainBuyIndicator': mainBuyIndicator,
            'mainSellIndicator': mainSellIndicator,
            'stopLossAtr': numericalFields['stopLossAtr'] == 0 ? undefined : numericalFields['stopLossAtr'],
            'riskRewardRatio': numericalFields['riskRewardRatio'] == 0 ? undefined : numericalFields['riskRewardRatio'],
            'highPeriod': numericalFields['highPeriod'] == 0 ? undefined : numericalFields['highPeriod'],
            'minVolume': numericalFields['minVolume'],
            'maxDays': numericalFields['maxDays'],
            'timeframe': timeframe,
            'stoplossSwing': stoplossSwing,
            'limitOrder': limitOrder,
            'trailingStopLoss': trailingStopLoss,
            'expiration': 7,
            'multipleBuys': true
        } as Backtest.StrategyOptions;

        // fetch results here        
        postEndpoint<API.Index.PostBacktest, API.Index._PostBacktest>('backtest', strategyOptions)
            .then(results => {
                console.log('STATUS:', results['status']);
                setTimeout(() => { alert(results['status']); }, 1000);

                let id = results['id'];
                console.log(`Getting id ${id} from server!`);

                // cache id immediately
                dispatch(setBacktestID(id));

                // save the results
                let displayName = getBacktestDisplayName(strategyOptions);
                let newSave = [...savedResults, { id, display: displayName }];
                dispatch(setSavedResults(newSave));
            })
    }

    const previousStep = () => {
        setStep(step - 1);
    }

    // error checking
    const nextStep = () => {
        if (step == 0) {
            if (mainBuyIndicator == '' || !activeIndicators.includes(mainBuyIndicator)) {
                alert('Please select a main buy indicator.');
                return;
            }
            setBuyOptions(deriveIndicatorOptions());
        }
        else if (step == 1) {
            if (mainSellIndicator == '' || !activeIndicators.includes(mainSellIndicator)) {
                alert('Please select a main sell indicator.');
                return;
            }
            setSellOptions(deriveIndicatorOptions());
        }
        if (step < 2) {
            setStep(step + 1);
        }
    }

    const setStep = (step: number) => {
        // prefill previous form data
        if (step == 0) {
            // sets options
            (Object.keys(buyOptions) as IndicatorType.IndicatorNames[]).forEach((indicatorName) => {
                Object.keys(buyOptions[indicatorName] as Object).forEach(field => {
                    dispatch(setIndicatorOption({
                        indicatorName: indicatorName as IndicatorType.IndicatorNames,
                        field,
                        value: buyOptions[indicatorName]![field]
                    }));
                })
            })
            // sets on/off
            Object.keys(indicators).forEach(indicatorName => {
                dispatch(setIndicatorOn({
                    indicatorName: indicatorName as IndicatorType.IndicatorNames,
                    on: buyOptions.hasOwnProperty(indicatorName)
                }));
            })
        }
        else if (step == 1) {
            // sets options
            (Object.keys(sellOptions) as IndicatorType.IndicatorNames[]).forEach(indicatorName => {
                Object.keys(sellOptions[indicatorName] as Object).forEach(field => {
                    dispatch(setIndicatorOption({
                        indicatorName: indicatorName as IndicatorType.IndicatorNames,
                        field,
                        value: sellOptions[indicatorName]![field]
                    }));
                })
            })
            // sets on/off
            Object.keys(indicators).forEach(indicatorName => {
                dispatch(setIndicatorOn({
                    indicatorName: indicatorName as IndicatorType.IndicatorNames,
                    on: sellOptions.hasOwnProperty(indicatorName)
                }));
            })
        }
        setStateStep(step);
    }

    // when server signals that the results are ready
    const onResultsFinished = async (data: API.Pusher.OnResultsFinished) => {
        // get the results from database
        let results = await fetchBacktestResults(data.id);
        // store results in global state
        dispatch(setBacktestResults({ results: results, id: data.id }));
    }

    let activeIndicatorList = [...activeIndicators];
    activeIndicatorList.sort();

    let buyIndicators = JSON.stringify(buyOptions, null, 2).replace(/[{},']/g, '');
    buyIndicators = buyIndicators.split('\n').filter(x => x.trim().length > 0).join('\n');
    let sellIndicators = JSON.stringify(sellOptions, null, 2).replace(/[{},']/g, '');
    sellIndicators = sellIndicators.split('\n').filter(x => x.trim().length > 0).join('\n');

    return (
        <div className='create-backtest'>
            <Pusher
                channel={id}
                event='onResultsFinished'
                onUpdate={onResultsFinished}
            />
            <MediaQuery maxWidth='600px'>
                <IconButton
                    aria-label='more'
                    aria-controls='long-menu'
                    aria-haspopup='true'
                    onClick={() => { dispatch(setDrawer({ anchor: 'left', open: true })) }}
                    style={{ position: 'absolute', top: '1vh', left: '1vh' }}
                >
                    <MenuIcon />
                </IconButton>
            </MediaQuery>
            <h1 className='create-backtest-title'>New Backtest</h1>
            <div className='create-backtest-form'>
                <div className='create-backtest-stepper'>
                    <Stepper alternativeLabel activeStep={step} style={{ width: '100%', height: '100%', backgroundColor: '#dee4ec' }}>
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
                <div className='create-backtest-form-body'>
                    <div className='create-backtest-form-body-content'>
                        {
                            step == 0 && (
                                <>
                                    {/* <h2 className='create-backtest-form-body-title'>Customize your buy criterias.</h2> */}
                                    <h3 className='create-backtest-subtitle'>Select buy indicators to identify entry signals.</h3>
                                    <div className='create-backtest-indicator-list'>
                                        {(Object.keys(indicators) as IndicatorType.IndicatorNames[]).map((indicatorName, index) => {
                                            return <Indicator name={indicatorName} fields={indicators[indicatorName]['fields']} default={indicators[indicatorName]['default']} key={index}
                                                active={activeIndicators.includes(indicatorName)} options={indicatorOptions[indicatorName]} />
                                        })}
                                    </div>
                                    <h3 className='create-backtest-subtitle'>Select a main indicator to initiate buy events.</h3>
                                    <div className='create-backtest-main-indicator-list'>
                                        {activeIndicatorList.length == 0 && (
                                            <p className='create-backtest-error'>No indicators selected...</p>
                                        )}
                                        {activeIndicatorList.map((indicatorName, index) => {
                                            return <MainIndicatorOption name={indicatorName} isChecked={mainBuyIndicator == indicatorName} key={index}
                                                setMainIndicator={setMainIndicator} isBuy={true} />
                                        })}
                                    </div>
                                </>
                            )}
                        {
                            step == 1 && (
                                <>
                                    {/* <h2 className='create-backtest-form-body-title'>Customize your sell criterias.</h2> */}
                                    <h3 className='create-backtest-subtitle'>Select sell indicators to identify exit signals.</h3>
                                    <div className='create-backtest-indicator-list'>
                                        {(Object.keys(indicators) as IndicatorType.IndicatorNames[]).map((indicatorName, index) => {
                                            return <Indicator name={indicatorName} fields={indicators[indicatorName]['fields']} default={indicators[indicatorName]['default']} key={index}
                                                active={activeIndicators.includes(indicatorName)} options={indicatorOptions[indicatorName]} />
                                        })}
                                    </div>
                                    <h3 className='create-backtest-subtitle'>Select a main indicator to initiate a sell events.</h3>
                                    <div className='create-backtest-main-indicator-list'>
                                        {activeIndicatorList.length == 0 && (
                                            <p className='create-backtest-error'>No indicators selected...</p>
                                        )}
                                        {activeIndicatorList.map((indicatorName, index) => {
                                            return <MainIndicatorOption name={indicatorName} isChecked={mainSellIndicator == indicatorName} key={index}
                                                setMainIndicator={setMainIndicator} isBuy={false} />
                                        })}
                                    </div>
                                </>
                            )
                        }
                        {
                            step == 2 && (
                                <>
                                    {/* <h2 className='create-backtest-form-body-title'>Confirm your strategy.</h2> */}
                                    <div className='create-backtest-form-body-split create-backtest-confirmation'>
                                        <div>
                                            <h3 className='create-backtest-subtitle'>Additional Options</h3>
                                            <div className='create-backtest-form-body-split'>
                                                <div className='create-backtest-additional-options'>
                                                    <div>
                                                        <TextField label='Stop Loss ATR' value={stopLossAtr}
                                                            onChange={(e) => {
                                                                setStopLossAtr(e.target.value);
                                                            }}
                                                            helperText='1 to sell at 1 ATR below. 0 to disable.'
                                                            error={errors['stopLossAtr']} />
                                                    </div>
                                                    <div>
                                                        <TextField label='Minimum Volume' value={minVolume}
                                                            onChange={(e) => {
                                                                setMinVolume(e.target.value);
                                                            }}
                                                            helperText='Buy if above volume.'
                                                            error={errors['minVolume']} />
                                                    </div>
                                                    <div>
                                                        <FormControl >
                                                            <InputLabel>Timeframe</InputLabel>
                                                            <Select
                                                                value={timeframe}
                                                                onChange={(e) => {
                                                                    setTimeframe(e.target.value as Timeframe)
                                                                }}
                                                            >
                                                                <MenuItem value={'1Day'}>1 Day</MenuItem>
                                                                <MenuItem value={'1Hour'}>1 Hour</MenuItem>
                                                            </Select>
                                                        </FormControl>
                                                    </div>
                                                    <div>
                                                        <FormControlLabel
                                                            control={
                                                                <Checkbox
                                                                    checked={stoplossSwing}
                                                                    onChange={(e) => {
                                                                        setStoplossSwing(e.target.checked);
                                                                    }}
                                                                    color='primary'
                                                                />
                                                            }
                                                            label='Stop Below Swing Low'
                                                        />
                                                    </div>
                                                    <div>
                                                        <FormControlLabel
                                                            control={
                                                                <Checkbox
                                                                    checked={limitOrder}
                                                                    onChange={(e) => {
                                                                        setLimitOrder(e.target.checked);
                                                                    }}
                                                                    color='primary'
                                                                />
                                                            }
                                                            label='Use Limit Order'
                                                        />
                                                    </div>
                                                    {/* <div>
                                                            <FormControlLabel
                                                                control={
                                                                    <Checkbox
                                                                        checked={trailingStopLoss}
                                                                        onChange={(e) => {
                                                                            setState({ trailingStopLoss: e.target.checked });
                                                                        }}
                                                                        color='primary'
                                                                    />
                                                                }
                                                                label='Use Trailing Stop'
                                                            />
                                                        </div> */}
                                                </div>
                                                <div className='create-backtest-additional-options'>
                                                    <div>
                                                        <TextField label='Risk Reward Ratio' value={riskRewardRatio}
                                                            onChange={(e) => {
                                                                setRiskRewardRatio(e.target.value);
                                                            }}
                                                            helperText='2 for 2:1 ratio. 0 to disable.'
                                                            error={errors['riskRewardRatio']} />
                                                    </div>
                                                    <div>
                                                        <TextField label='High Period' value={highPeriod}
                                                            onChange={(e) => {
                                                                setHighPeriod(e.target.value);
                                                            }}
                                                            helperText='Cancel buy if target > x day high.'
                                                            error={errors['highPeriod']} />
                                                    </div>
                                                    <div>
                                                        <TextField label='Max Days' value={maxDays}
                                                            onChange={(e) => {
                                                                setMaxDays(e.target.value);
                                                            }}
                                                            helperText='Sell if held longer than max days.'
                                                            error={errors['maxDays']} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className='create-backtest-review-criterias'>
                                            <h3 className='create-backtest-subtitle'>Buy Criterias:</h3>
                                            <p>Main Indicator: {mainBuyIndicator}</p>
                                            <pre id='json' style={{ fontSize: '1em' }}>{buyIndicators}</pre>
                                        </div>
                                        <div className='create-backtest-review-criterias'>
                                            <h3 className='create-backtest-subtitle'>Sell Criterias:</h3>
                                            <p>Main Indicator: {mainSellIndicator}</p>
                                            <pre id='json' style={{ fontSize: '1em' }}>{sellIndicators}</pre>
                                        </div>
                                    </div>
                                </>
                            )
                        }
                    </div>
                    <div className='create-backtest-actions'>
                        <Button variant='contained' onClick={previousStep} color='primary' disabled={step == 0}>
                            Previous
                        </Button>
                        <Button variant='contained' onClick={step < 2 ? nextStep : getResults} color='primary'>
                            {step < 2 ? 'Next' : 'Get Results'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface MainIndicatorOptionProps {
    isBuy: boolean;
    name: IndicatorType.IndicatorNames;
    isChecked: boolean;
    setMainIndicator: (isBuy: boolean, indicator: IndicatorType.IndicatorNames) => void;
}

const MainIndicatorOption: React.FC<MainIndicatorOptionProps> = (props) => {
    const setMainIndicator = () => {
        props.setMainIndicator(props.isBuy, props.name);
    }

    return <div className='indicator-header'>
        <input className='indicator-box' type='radio' checked={props.isChecked} name={`main${props.isBuy ? 'Buy' : 'Sell'}`} value={props.name}
            onChange={(e) => { setMainIndicator() }} />
        <span className='indicator-text'>{props.name}</span>
    </div>
}

export default CreateBacktest;