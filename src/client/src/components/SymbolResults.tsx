import React, { useState, useEffect } from 'react';
import { viewEvent } from '../redux/slices/backtestSlice';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import './SymbolResults.css';
import 'react-tabs/style/react-tabs.css';
import { formatDate, daysBetween } from "../helpers/utils";
import { getEndpoint } from '../helpers/api';

import ArrowForwardSharpIcon from '@material-ui/icons/ArrowForwardSharp';
import CasinoIcon from '@material-ui/icons/Casino';
import IconButton from '@material-ui/core/IconButton';

import API from '../types/api';

const SymbolResults = () => {
    const dispatch = useAppDispatch();
    const [numWins, setNumWins] = useState(0);
    const [numLosses, setNumLosses] = useState(0);
    const [averageSpan, setAverageSpan] = useState(0);
    const [latestPrice, setLatestPrice] = useState(0);
    const results = useAppSelector(state => state.backtest.results.symbolData[state.backtest.selectedSymbol]);
    const symbol = useAppSelector(state => state.backtest.selectedSymbol);

    useEffect(() => {
        analyze();
    }, [results])

    // statistical analysis
    const analyze = () => {
        let numWins = 0;
        let numLosses = 0;
        let averageSpan = 0;
        results["events"].forEach(event => {
            if (event["profit"] > 0) {
                numWins += 1;
            }
            if (event["profit"] < 0) {
                numLosses += 1;
            }
            averageSpan += event["span"];
        })
        setNumWins(numWins);
        setNumLosses(numLosses);
        setAverageSpan(averageSpan / results["events"].length);

        // fetch latest price
        getEndpoint<API.Symbol.GetLatestPrice, API.Symbol._GetLatestPrice>('symbol/latestPrice', { symbol })
            .then(latestPrice => setLatestPrice(latestPrice["close"]))
    }

    const onDiceRoll = () => {
        let randomIndex = Math.floor(Math.random() * results["events"].length);
        dispatch(viewEvent(randomIndex));
    }

    let profit = results["profit"].toFixed(2);
    let percentProfit = (100 * results["percentProfit"]).toFixed(4);
    let reversedEvents = [...results["events"]].reverse();

    return (
        <>
            <div className="symbol-results">
                <IconButton className="symbol-results-random" style={{ position: "absolute" }} onClick={onDiceRoll}>
                    <CasinoIcon />
                </IconButton>
                <h2 className="symbol-results-title">{symbol}<br />${latestPrice.toFixed(2)}</h2>
                <div className="symbol-results-body">
                    <div>Wins: {numWins}</div>
                    <div>Losses: {numLosses}</div>
                    <div>Win Rate: {(numWins / (numLosses + numWins) * 100).toFixed(2)}%</div>
                    <div>Profit: ${profit}</div>
                    <div>Percent Profit: {percentProfit}%</div>
                    <div>Average Span: {Math.floor(averageSpan)} days</div>
                </div>
                <h3 className="symbol-results-subtitle">Events</h3>
                <div className="symbol-results-events">
                    {
                        reversedEvents.map((event, index) => {
                            return (<div className="symbol-results-event" key={`symbol-results-${index}`} onClick={() => { dispatch(viewEvent(results["events"].length - 1 - index)) }}
                                style={{ color: `${event["percentProfit"] > 0 ? "green" : "red"}` }}>
                                <span>{formatDate(event["buyDate"])}</span>
                                <ArrowForwardSharpIcon />
                                <span>{formatDate(event["sellDate"])}</span>
                            </div>);
                        })
                    }
                </div>
            </div>
        </>
    );
}

export default SymbolResults;
