import React, { useState, useEffect } from 'react';
import './Indicators.css';
import caret from "../images/arrow.svg";
import { useAppSelector, useAppDispatch } from '../redux/hooks';
import { setIndicatorOn, setIndicatorOption } from '../redux/slices/indicatorSlice';
import { setBacktestID } from '../redux/slices/backtestSlice';
import Indicator from "./Indicator";
import IndicatorType from '../types/indicator';

const Indicators: React.FC = () => {
    const dispatch = useAppDispatch();
    const [step, setStep] = useState(0);
    const indicatorOptions = useAppSelector(state => state.indicator.options);
    const activeIndicators = useAppSelector(state => state.indicator.actives);
    const backtestIndicatorOptions = useAppSelector(state => state.backtest.results.strategyOptions.buyIndicators);

    interface IndicatorFieldDefinition {
        [key: string]: {
            fields: string[];
            default: number[];
        }
    }

    const indicators = {
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
        "Trend": { "fields": ["period"], "default": [10] },
        "High": { "fields": ["period"], "default": [100] },
    } as IndicatorFieldDefinition

    useEffect(() => {
        // Set default values for all indicators
        (Object.keys(indicators) as IndicatorType.IndicatorNames[]).map((indicatorName, index) => {
            // if not used in backtest, use default values
            if (!backtestIndicatorOptions.hasOwnProperty(indicatorName)) {
                // initialize global state with default values
                indicators[indicatorName]["fields"].map((field, index) => {
                    setIndicatorOption({ indicatorName, field, value: indicators[indicatorName]["default"][index] });
                })
            }
        })

        // Special Cases
        if (backtestIndicatorOptions.hasOwnProperty("Divergence")) {
            setIndicatorOption({ indicatorName: "RSI", field: indicators["RSI"]["fields"][0], value: indicators["RSI"]["default"][0] });
            setIndicatorOption({ indicatorName: "RSI", field: indicators["RSI"]["fields"][1], value: 0 });
            setIndicatorOption({ indicatorName: "RSI", field: indicators["RSI"]["fields"][2], value: 100 });
            setIndicatorOn({ indicatorName: "RSI", on: true });
        }
    }, [])

    return (
        <div className="indicators">
            <h2 className="indicators-title">Indicators</h2>
            <div className="indicators-list">
                {(Object.keys(indicators) as IndicatorType.IndicatorNames[]).map((indicatorName, index) => {
                    return <Indicator name={indicatorName} fields={indicators[indicatorName]["fields"]} default={indicators[indicatorName]["default"]} key={index}
                        active={activeIndicators.includes(indicatorName)} options={indicatorOptions[indicatorName]} />
                })}
            </div>
        </div>
    );
}

export default Indicators;
