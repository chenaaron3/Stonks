import path from 'path';
import fs from 'fs';
import { fork } from 'child_process';
import sgMail from '@sendgrid/mail';

// own helpers
import csv from 'csv';
import { getIndicator } from './indicators';
import { fixFaulty, getPrices } from './stock';
import { getDocument, setDocumentField, addDocument } from './mongo';
import { daysBetween, getBacktestSummary, getAdjustedData } from './utils';
import { sortResultsByScore } from '../client/src/helpers/utils';
import { triggerChannel } from './pusher';
import { addJob } from './queue';
import { cancelPreviousOrders, requestBracketOrder, getPositions, changeAccount, requestMarketOrderSell } from './alpaca';
import Indicator from './indicators/indicator';

import { MongoResults, MongoUser } from '../types/types';
import Backtest from '@shared/backtest';
import IndicatorTypes from '@shared/indicator';
import { BacktestMessage, OptimizeIndicatorsJobRequest, OptimizeIndicatorsMessage, OptimizeStoplossTargetMessage, ProgressMessage } from '../types/job';
import { StockData, BarData } from '@shared/common';

// paths to resources
let PATH_TO_SYMBOLS = path.join(__dirname, '../../res/symbols.json');
let PATH_TO_FAULTY = path.join(__dirname, '../../res/faulty.json');
let PATH_TO_BLACKLIST = path.join(__dirname, '../../res/blacklist.json');

// only get symbols from these exchanges
let EXCHANGES = ['amex', 'nasdaq', 'nyse'];

// cache settings
const useCache = true;

//#region Subscribed Backtests
// get actions today for a backtest
async function getActionsToday(id: string, email: string) {
    return addJob(() => {
        return new Promise(async resolveJob => {
            // get backtest document
            let doc = await getDocument<MongoResults>('results', id);
            if (!doc) {
                resolveJob();
                return;
            }
            let symbols = Object.keys(doc['results']['symbolData']);
            // get user document
            let userDoc = await getDocument<MongoUser>('users', email);
            if (!userDoc) {
                resolveJob();
                return;
            }
            let watchlist = Object.keys(userDoc['buys']);
            let positions: string[] = [];
            let today = new Date();
            let actions: { buy: string[], sell: string[] } = { buy: [], sell: [] };
            let buyData: { [key: string]: { holding: Backtest.HoldingData } } = {};
            let sellData: { [key: string]: { event: Backtest.EventData } } = {};
            let alpacaCredentials = undefined;
            let useAlpaca = false;
            let tradeSettings = undefined;
            if (id in userDoc['backtestSettings']) {
                alpacaCredentials = userDoc['backtestSettings'][id]['alpaca']
                tradeSettings = userDoc['backtestSettings'][id]['tradeSettings']
                useAlpaca = alpacaCredentials['id'].length > 0 && alpacaCredentials['key'].length > 0;
            }

            console.log(`Getting actions for id: ${id}, alpaca: ${useAlpaca}`)

            // add positions to watchlist
            if (useAlpaca) {
                // change accounts using credentials
                changeAccount(alpacaCredentials!);
                positions = (await getPositions()).map(p => p['symbol']);
                watchlist = watchlist.concat(positions);
            }

            // look for buy and sell symbols
            for (let i = 0; i < symbols.length; ++i) {
                let symbol = symbols[i];
                let symbolData = doc['results']['symbolData'][symbol];
                let events = symbolData['events'];
                let lastEvent = events.length > 0 ? events[events.length - 1] : undefined;

                // look through holdings for buy actions  
                let holdings = symbolData['holdings'];
                if (holdings.length > 0 && daysBetween(today, new Date(holdings[holdings.length - 1]['buyDate'])) == 0) {
                    actions['buy'].push(symbol);
                    buyData[symbol] = {
                        holding: holdings[holdings.length - 1]
                    }
                }

                // look at last event for sell actions
                if (watchlist.includes(symbol) && lastEvent && daysBetween(today, new Date(lastEvent['sellDate'])) == 0) {
                    actions['sell'].push(symbol);
                    sellData[symbol] = {
                        event: lastEvent
                    }
                }
            }

            if (useAlpaca) {
                // clear all alpaca buy orders carried over from previous day
                await cancelPreviousOrders();

                // execute alpaca orders for buys
                let scoreBy = (tradeSettings && tradeSettings['scoreBy']) ? tradeSettings['scoreBy'] : 'Percent Profit';
                let sortedSymbols = sortResultsByScore(doc['results'], scoreBy);
                actions['buy'].sort((a, b) => sortedSymbols.indexOf(a) - sortedSymbols.indexOf(b))

                let buyOrders = [];
                for (let i = 0; i < actions['buy'].length; ++i) {
                    let buySymbol = actions['buy'][i];
                    let holding = buyData[buySymbol]['holding'];
                    // qualify for bracket orders
                    let stoplossTarget = holding['stoplossTarget'];
                    if (stoplossTarget && stoplossTarget.risk && stoplossTarget.stoploss && stoplossTarget.target) {
                        // add to alpaca
                        let risk = holding['stoplossTarget']['risk'];
                        let stoploss = holding['stoplossTarget']['stoploss'];
                        let target = holding['stoplossTarget']['target'];
                        let buyPrice = stoploss! / (1 - risk! / 100);
                        let positionSize = .05;
                        let shouldTrade = true;

                        // adjust parameters
                        if (tradeSettings) {
                            console.log(tradeSettings);
                            // trade if below risk parameter
                            if (tradeSettings['maxRisk']) shouldTrade = risk! <= parseInt(tradeSettings['maxRisk'].toString());
                            console.log(shouldTrade);
                            // check if portfolio is maxed out already
                            if (tradeSettings['maxPositions']) shouldTrade = shouldTrade && (positions.length + buyOrders.length <= Number(tradeSettings['maxPositions']));
                            console.log(shouldTrade, positions.length, buyOrders.length);
                            if (!shouldTrade) console.log(positions)
                            // adjust position size by how many positions desired in portfolio
                            if (tradeSettings['maxPositions']) positionSize = 1 / (parseInt(tradeSettings['maxPositions'].toString()));
                            console.log(shouldTrade);
                        }

                        if (shouldTrade) {
                            try {
                                await requestBracketOrder(buySymbol, buyPrice, positionSize, stoploss!, target!);
                                buyOrders.push(buySymbol);
                                console.log('Successfully Ordered:', buySymbol);
                            }
                            catch (e) {
                                console.log('Order Failed:', e)
                                // insufficient buying power                            
                            }
                        }
                    }
                }
                actions['buy'] = buyOrders;

                // execute alpaca orders for sells (overdue)
                actions['sell'].forEach(async sellSymbol => {
                    let marketOrderReasons: Backtest.EventReason[] = ['overdue', 'indicator'];
                    if (marketOrderReasons.includes(sellData[sellSymbol]['event']['reason'])) {
                        await requestMarketOrderSell(sellSymbol);
                    }
                })
            }

            console.log(`#Buys: ${actions['buy'].length}, #Sells: ${actions['sell'].length}`)

            // only send email if there are stocks to sell or bought stocks in alpaca
            if (actions['sell'].length + actions['buy'].length > 0) {
                let text = '';
                if (actions['sell'].length > 0) {
                    text += `Symbols to sell:\n` +
                        `${actions['sell'].join('\n')}\n` +
                        `View at ${process.env.DOMAIN}/${id}\n`;
                }
                if (actions['buy'].length > 0) {
                    if (useAlpaca) {
                        text += `Buy orders sent to Alpaca:\n` +
                            `${actions['buy'].join('\n')}\n` +
                            `View at https://app.alpaca.markets/paper/dashboard/overview\n`;
                    }
                    else {
                        text += `Symbols to buy:\n
                    ${actions['buy'].join('\n')}
                    View at ${process.env.DOMAIN}/${id}\n`;
                    }
                }

                // send email
                sgMail.setApiKey(process.env.SENDGRID_API_KEY);
                const msg = {
                    to: email,
                    from: 'backtest@updated.com',
                    subject: 'Stock Updates!',
                    text: text
                };
                sgMail.send(msg)
                    .then(() => console.log('Email sent to', email))
                    .catch(function (err) {
                        console.log(err);
                        console.log(err['response']['body']['errors'])
                    })
            }
            else {
                console.log('No email sent')
            }
            resolveJob();
        })
    });
}
//#endregion

//#region Queue Jobs
// queues a backtest
function backtest(id: string, strategyOptions: Backtest.StrategyOptions) {
    return addJob(() => {
        return new Promise(async resolveJob => {
            // spawn child to do work
            let child = fork(path.join(__dirname, '../helpers/worker.js'));
            child.send({ type: 'startBacktest', strategyOptions, id });
            child.on('message', async function (message: BacktestMessage) {
                console.log(message);
                if (message.status == 'finished') {
                    console.log('Trigger client', id);
                    triggerChannel(id, 'onResultsFinished', { id: `${id}` });

                    // fix faulty data if any
                    let results = await fixFaulty();
                    console.log(results);

                    resolveJob();
                }
            });
        });
    });
}

// queues a backtest update
function updateBacktest(id: string) {
    return addJob(() => {
        return new Promise(async resolveJob => {
            let doc = await getDocument<MongoResults>('results', id);
            if (!doc) return;
            // same day needs no update
            if (daysBetween(new Date(doc['lastUpdated']), new Date()) < 1) {
                resolveJob();
                return;
            }
            // already updating, probably not needed because of check above
            else if (doc['status'] == 'updating') {
                // resolveJob();
                // return;
            }

            setDocumentField('results', id, 'status', 'updating', undefined);
            let strategyOptions = doc['results']['strategyOptions'];

            // spawn child to do work
            let child = fork(path.join(__dirname, '../helpers/worker.js'));
            child.send({ type: 'startBacktest', strategyOptions, id });
            child.on('message', function (message: BacktestMessage) {
                if (message.status == 'finished') {
                    setDocumentField('results', id, 'status', 'ready', undefined);
                    console.log('Trigger client', id);
                    triggerChannel(id, 'onUpdateFinished', { id: `${id}` });
                    resolveJob();
                }
            });
        });
    });
}

// queues an optimization
function optimizeStoplossTarget(id: string, optimizeOptions: Backtest.OptimizeOptions) {
    let maxResults = 15;
    let totalRatios = (optimizeOptions['endRatio'] - optimizeOptions['startRatio']) / optimizeOptions['strideRatio'];
    if (totalRatios > maxResults) {
        optimizeOptions['endRatio'] = optimizeOptions['startRatio'] + optimizeOptions['strideRatio'] * (maxResults - 1);
    }
    let position = undefined;
    // make a job for each stoploss option
    for (let stoploss = optimizeOptions['startStoploss']; stoploss < optimizeOptions['endStoploss']; stoploss += optimizeOptions['strideStoploss']) {
        let optimizeOptionsCopy = { ...optimizeOptions };
        optimizeOptionsCopy['startStoploss'] = stoploss;
        optimizeOptionsCopy['endStoploss'] = stoploss + optimizeOptions['strideStoploss'];
        let p = addJob(() => {
            return new Promise(async resolveJob => {
                // spawn child to do work
                let child = fork(path.join(__dirname, '../helpers/worker.js'));
                child.send({ type: 'startOptimizeStoplossTarget', id, optimizeOptions: optimizeOptionsCopy });
                child.on('message', async function (message: OptimizeIndicatorsMessage) {
                    if (message.status == 'finished') {
                        console.log('Trigger client', id);
                        triggerChannel(id, 'onOptimizeFinished', { id: `${id}` });
                        resolveJob();
                    }
                });
            });
        });
        if (position == undefined) {
            position = p
        }
    }

    return position;
}

// queues an optimization
function optimizeIndicators(id: string, indicatorOptions: IndicatorTypes.Indicators) {
    return addJob(() => {
        return new Promise(async resolveJob => {
            // spawn child to do work
            let child = fork(path.join(__dirname, '../helpers/worker.js'));
            child.send({ type: 'startOptimizeIndicators', id, indicatorOptions });
            child.on('message', async function (message: OptimizeIndicatorsMessage) {
                if (message.status == 'finished') {
                    console.log('Trigger client', id);
                    triggerChannel(id, 'onOptimizeIndicatorsFinished', { id: `${id}` });
                    resolveJob();
                }
            });
        });
    });
}
//#endregion

//#region Conduct Workers
// conduct a backtest with given strategy
function conductBacktest(strategyOptions: Backtest.StrategyOptions, id: string) {
    return new Promise<void>(resolve => {
        // get list of symbols to query
        getSymbols(true).then(async (symbols) => {
            // Uncomment to test a portion of symbols
            // symbols = symbols.slice(0, 50);
            // Uncoment to test custom symbols
            // symbols = ['AMZN'];

            // try to get previous results
            let previousResults = await getDocument<MongoResults>('results', id);
            if (previousResults && typeof (previousResults['results']) == 'string') {
                previousResults = undefined;
            }
            // maps symbol to buy/sell data
            let intersections: Backtest.SymbolData = {};

            // create threads that split up the work
            let finishedWorkers = 0;
            let partitionSize = Math.ceil(symbols.length / Number(process.env.NUM_THREADS));
            let progress = 0;
            for (let i = 0; i < Number(process.env.NUM_THREADS); ++i) {
                // divy up the symbols for each thread to work on
                let partition = symbols.slice(i * partitionSize, (i + 1) * partitionSize);

                // spawn child to do work
                let child = fork(path.join(__dirname, 'worker.js'));
                child.on('message', async (msg: BacktestMessage | ProgressMessage) => {
                    if (msg.status == 'finished') {
                        // assign partition's results to collective results
                        Object.assign(intersections, msg.intersections);
                        // if all worker threads are finished
                        if (++finishedWorkers == Number(process.env.NUM_THREADS)) {
                            // check for faulty data
                            let faulty: string[] = [];
                            if (fs.existsSync(PATH_TO_FAULTY)) {
                                faulty = JSON.parse(fs.readFileSync(PATH_TO_FAULTY, { encoding: 'utf-8' }));
                                Object.keys(intersections).forEach(symbol => {
                                    if (intersections[symbol]['faulty'] && !faulty.includes(symbol)) {
                                        faulty.push(symbol);
                                    }
                                })
                            }
                            // save faulty list
                            fs.writeFileSync(PATH_TO_FAULTY, JSON.stringify(faulty), { encoding: 'utf-8' });

                            let results = {
                                strategyOptions, symbolData: intersections, lastUpdated: new Date(),
                                created: previousResults ? previousResults['results']['created'] : new Date()
                            };
                            // add result to database
                            if (await getDocument('results', id)) {
                                await setDocumentField('results', id, 'summary', getBacktestSummary(results), undefined);
                                await setDocumentField('results', id, 'results', results, { subField: 'symbolData' });
                            }
                            resolve();
                        }
                    }
                    if (msg.status == 'progress') {
                        progress += msg.progress;
                        triggerChannel(id, 'onProgressUpdate', { progress: 100 * progress / symbols.length });
                    }
                })
                child.send({ type: 'backtestJob', strategyOptions, id, previousResults, partition });
            }
        });
    })
}

// conduct an optimization with optimize options
function conductStoplossTargetOptimization(id: string, optimizeOptions: Backtest.OptimizeOptions) {
    return new Promise<void>(async (resolve, reject) => {
        // try to get previous results
        let previousResults = await getDocument('results', id);
        if (!previousResults || typeof (previousResults['results']) == 'string') {
            reject('Optimize Error: Backtest results does not exist!');
            return;
        }

        // list of results
        let results: Backtest.ResultsData[] = [];
        let strategyOptions = previousResults['results']['strategyOptions'];
        let newIDs: string[] = [];
        // fill in skeleton
        for (let stoploss = optimizeOptions['startStoploss']; stoploss < optimizeOptions['endStoploss']; stoploss += optimizeOptions['strideStoploss']) {
            for (let ratio = optimizeOptions['startRatio']; ratio < optimizeOptions['endRatio']; ratio += optimizeOptions['strideRatio']) {
                let strategyOptionsCopy = { ...strategyOptions };
                strategyOptionsCopy['stopLossAtr'] = stoploss;
                strategyOptionsCopy['riskRewardRatio'] = ratio;
                results.push({
                    strategyOptions: strategyOptionsCopy,
                    symbolData: {},
                    lastUpdated: previousResults['results']['lastUpdated'],
                    created: previousResults['results']['created']
                })
                newIDs.push(`${id}_optimized_${stoploss.toFixed(2)}_${ratio.toFixed(2)}`);
            }
        }

        // create threads that split up the work
        let finishedWorkers = 0;
        let symbols = Object.keys(previousResults['results']['symbolData']);
        let partitionSize = Math.ceil(symbols.length / Number(process.env.NUM_THREADS));
        let progress = 0;
        for (let i = 0; i < Number(process.env.NUM_THREADS); ++i) {
            // divy up the symbols for each thread to work on
            let partition = symbols.slice(i * partitionSize, (i + 1) * partitionSize);

            // spawn child to do work
            let child = fork(path.join(__dirname, 'worker.js'));
            child.on('message', async (msg: OptimizeStoplossTargetMessage | ProgressMessage) => {
                if (msg.status == 'finished') {
                    console.log('WORKER FINISHED');
                    // enter optimized data into results
                    let optimizedData = msg.optimizedData;
                    Object.keys(optimizedData).forEach(symbol => {
                        optimizedData[symbol].forEach((symbolData, i) => {
                            results[i]['symbolData'][symbol] = symbolData;
                        });
                    });

                    // if all worker threads are finished
                    if (++finishedWorkers == Number(process.env.NUM_THREADS)) {
                        console.log('Finished optimization.');
                        // add result to database
                        for (let resultsIndex = 0; resultsIndex < results.length; resultsIndex++) {
                            console.log('Adding result #' + resultsIndex);
                            let newID = newIDs[resultsIndex];
                            // create a new document for each combination
                            await addDocument('results', { _id: newID });
                            // fill in the document
                            await setDocumentField('results', newID, 'summary', getBacktestSummary(results[resultsIndex]), undefined);
                            await setDocumentField('results', newID, 'results', results[resultsIndex], { subField: 'symbolData' });
                            // link optimized to base
                            await setDocumentField('results', newID, '_optimized', { base: id }, undefined);
                        }

                        // store more info in base
                        let optimizedIDs: string[] = [];
                        if (previousResults!['_optimized'] && previousResults!['_optimized']['ids']) {
                            optimizedIDs = previousResults!['_optimized']['ids'];
                        }
                        newIDs.forEach(newID => {
                            if (!optimizedIDs.includes(newID)) {
                                optimizedIDs.push(newID);
                            }
                        });

                        await setDocumentField('results', id, '_optimized', { base: id, ids: optimizedIDs }, undefined);
                        resolve();
                    }
                }
                else if (msg.status == 'progress') {
                    progress += msg.progress;
                    triggerChannel(id, 'onOptimizeProgressUpdate', { progress: 100 * progress / symbols.length });
                }
            })
            child.send({ type: 'optimizeStoplossTargetJob', partition, id, previousResults, optimizeOptions });
        }
    })
}

function conductIndicatorOptimization(id: string, indicatorOptions: IndicatorTypes.Indicators) {
    return new Promise<void>(async (resolve, reject) => {
        let previousResults = await getDocument('results', id);
        if (!previousResults || typeof (previousResults['results']) == 'string') {
            reject('Optimize Error: Backtest results does not exist!');
            return;
        }

        // create threads that split up the work
        let finishedWorkers = 0;
        let symbols = Object.keys(previousResults['results']['symbolData']); //.slice(0, 50);
        let partitionSize = Math.ceil(symbols.length / Number(process.env.NUM_THREADS));
        let progress = 0;
        let indicatorData = {};
        for (let i = 0; i < Number(process.env.NUM_THREADS); ++i) {
            // divy up the symbols for each thread to work on
            let partition = symbols.slice(i * partitionSize, (i + 1) * partitionSize);

            // spawn child to do work
            let child = fork(path.join(__dirname, 'worker.js'));
            child.on('message', async (msg: OptimizeIndicatorsMessage | ProgressMessage) => {
                if (msg.status == 'finished') {
                    // accumulate worker's data
                    Object.assign(indicatorData, msg.optimizedData);

                    // if all worker threads are finished
                    if (++finishedWorkers == Number(process.env.NUM_THREADS)) {
                        // enter data into indicator collection 
                        await addDocument('indicators', { _id: id });
                        // fill in the document
                        await setDocumentField('indicators', id, 'data', indicatorData, undefined);
                        resolve();
                    }
                }
                if (msg.status == 'progress') {
                    progress += msg.progress;
                    triggerChannel(id, 'onOptimizeIndicatorsProgressUpdate', { progress: 100 * progress / symbols.length });
                }
            })
            child.send({ type: 'optimizeIndicatorsJob', partition, id, previousResults, indicatorOptions });
        }
    });
}
//#endregion

//#region Worker Functions
// given an existing backtest, record all the indicator data
function optimizeIndicatorsForSymbol(indicatorOptions: IndicatorTypes.Indicators, symbol: string, results: Backtest.SymbolDataEntry, strategyOptions: Backtest.StrategyOptions) {
    return new Promise<Backtest.OptimizeData>((resolve, reject) => {
        // cache the field names
        let indicatorFields: string[] = null!;
        getPrices(symbol, strategyOptions['timeframe'])
            .then(json => {
                // if error
                if (json.hasOwnProperty('error')) {
                    reject((json as { error: string; })['error']);
                }
                // if valid prices
                else {
                    // get price and indicator setup
                    let { prices, volumes, opens, highs, lows, closes, dates } = getAdjustedData(json as BarData[], undefined, undefined);
                    let indicators: { [key: string]: Indicator } = {};
                    let indicatorNames = Object.keys(indicatorOptions) as IndicatorTypes.IndicatorNames[];
                    indicatorNames.forEach(indicatorName => {
                        indicators[indicatorName] = getIndicator(indicatorName, indicatorOptions[indicatorName], symbol, dates, prices, opens, highs, lows, closes);
                    });

                    let indicatorData: Backtest.OptimizeEventData[] = [];
                    // record indicator values at every event
                    results['events'].forEach(event => {
                        let buyDate = event['buyDate'];
                        let data: { [key: string]: number } = {};

                        // record data from each indicator
                        indicatorNames.forEach(indicatorName => {
                            let value = indicators[indicatorName].getValue(buyDate);
                            if (typeof (value) == 'number') {
                                let numericalValue = value;
                                data[indicatorName] = numericalValue;
                            }
                            else if (typeof (value) == 'object') {
                                let objectValue = value;
                                Object.keys(objectValue).forEach(key => {
                                    data[key] = objectValue[key];
                                })
                            }
                        });
                        // manually include the price
                        data['Price'] = prices[buyDate];

                        // flatten the data to an array
                        if (!indicatorFields) {
                            indicatorFields = Object.keys(data).sort();
                        }
                        let flattenedData = indicatorFields.map(f => data[f]);
                        indicatorData.push({ indicators: flattenedData, percentProfit: event['percentProfit'], buyDate: buyDate });
                    });

                    resolve({ data: indicatorData, fields: indicatorFields });
                }
            });
    });
}

// given an existing backtest, apply different stoploss/target options
function optimizeStoplossTargetForSymbol(strategyOptions: Backtest.StrategyOptions, optimizeOptions: Backtest.OptimizeOptions, symbol: string, previousResults: Backtest.SymbolDataEntry) {
    return new Promise<{ results: Backtest.SymbolDataEntry[]; effective: number; count: number; }>((resolve, reject) => {
        getPrices(symbol, strategyOptions['timeframe'])
            .then(json => {
                // if error
                if (json.hasOwnProperty('error')) {
                    reject((json as { error: string; })['error']);
                }
                // if valid prices
                else {
                    // maps date to data
                    let { prices, volumes, opens, highs, lows, closes, dates } = getAdjustedData(json as BarData[], undefined, undefined);
                    let { mainIndicator: mainSellIndicator } = getIndicatorObjects(strategyOptions, 'sell', symbol, dates, prices, opens, highs, lows, closes)
                    let atr = getIndicator('ATR', { period: 12 }, symbol, dates, prices, opens, highs, lows, closes);
                    let high: Indicator = null!;
                    if (strategyOptions['highPeriod']) {
                        high = getIndicator('High', { period: strategyOptions['highPeriod'] }, symbol, dates, prices, opens, highs, lows, closes);
                    }
                    // list of symbol data for each stoploss/target combination  
                    let results: Backtest.SymbolDataEntry[] = [];
                    let count = 0;
                    let effective = 0;

                    let events = previousResults['events'];
                    for (let stoploss = optimizeOptions['startStoploss']; stoploss < optimizeOptions['endStoploss']; stoploss += optimizeOptions['strideStoploss']) {
                        strategyOptions['stopLossAtr'] = stoploss;
                        // length is equal to number of ratio combinations
                        let optimizedEvents: Backtest.EventData[][] = [];
                        let profits: { profit: number; percentProfit: number }[] = [];
                        let stoplossTargets: { [key: string]: Backtest.StoplossTargetData }[] = [];

                        // initialization for each ratio combination
                        for (let ratio = optimizeOptions['startRatio']; ratio < optimizeOptions['endRatio']; ratio += optimizeOptions['strideRatio']) {
                            optimizedEvents.push([]);
                            profits.push({ profit: 0, percentProfit: 0 });
                            stoplossTargets.push({});
                        }

                        // go through each buy event
                        for (let eventIndex = 0; eventIndex < events.length; ++eventIndex) {
                            let event = events[eventIndex];
                            let date = event['buyDate'];
                            let dateIndex = dates.indexOf(date);
                            let price = prices[date];
                            let buyDate = event['buyDate'];
                            let buyPrice = prices[buyDate];
                            count += optimizedEvents.length;

                            if (dateIndex == -1) {
                                continue;
                            }

                            // ignore events that were sold because of indicator
                            if (event['reason'] == 'indicator') {
                                optimizedEvents.forEach(oe => oe.push(event));
                                continue;
                            }

                            // set stoploss/target for all ratio combinations
                            let sold = [];
                            let soldCount = stoplossTargets.length;
                            let index = 0;
                            for (let ratio = optimizeOptions['startRatio']; ratio < optimizeOptions['endRatio']; ratio += optimizeOptions['strideRatio']) {
                                strategyOptions['riskRewardRatio'] = ratio;
                                let stoplossTarget = stoplossTargets[index];
                                setStoplossTarget(stoplossTarget, strategyOptions, price, date, atr, lows, highs, dates, dateIndex);
                                if (high && stoplossTarget.hasOwnProperty(date) && stoplossTarget[date]['target'] && stoplossTarget[date]['target']! > high.getGraph()['High'][date]) {
                                    delete stoplossTarget[date];
                                    sold.push(true);
                                    soldCount -= 1;
                                }
                                else {
                                    sold.push(false);
                                }
                                index += 1;
                            }

                            // keep incrementing date until all sold
                            for (; dateIndex < dates.length; ++dateIndex) {
                                // if all sold
                                if (soldCount == 0) {
                                    break;
                                }

                                let day = dates[dateIndex];
                                // indicator sell signal
                                if (mainSellIndicator.getAction(day, dateIndex, true) == Indicator.SELL) {
                                    // reconstruct event
                                    let sellPrice = prices[day];

                                    // sell all that were not already sold
                                    soldCount = 0;
                                    sold.forEach((isSold, i) => {
                                        if (!isSold) {
                                            let eventCopy = getOptimizedEvent(event, buyDate, buyPrice, day, sellPrice, 'indicator', stoplossTargets[i], profits[i]);
                                            optimizedEvents[i].push(eventCopy);
                                        }
                                    })
                                }
                                else {
                                    // loop through all combinations to check for sell signal 
                                    for (let i = 0; i < stoplossTargets.length; ++i) {
                                        // ignore if already sold
                                        if (sold[i]) {
                                            continue;
                                        }

                                        // add to corresponding events list and mark off as sold
                                        let earlyTrades = getEarlyTrades(strategyOptions, stoplossTargets[i], prices, highs, lows, dates, dateIndex);
                                        let hasEarlyTrades = Object.keys(earlyTrades).length > 0;
                                        if (hasEarlyTrades && earlyTrades.hasOwnProperty(buyDate)) {
                                            let sellPrice = prices[day];
                                            if (strategyOptions['limitOrder']) {
                                                sellPrice = earlyTrades[buyDate]['price'];
                                            }
                                            let eventCopy = getOptimizedEvent(event, buyDate, buyPrice, day, sellPrice, earlyTrades[buyDate]['reason'], stoplossTargets[i], profits[i]);
                                            optimizedEvents[i].push(eventCopy);
                                            sold[i] = true;
                                            soldCount -= 1;
                                            if (eventCopy['reason'] != event['reason']) {
                                                effective += 1;
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // append list of symboldata to results 
                        for (let i = 0; i < optimizedEvents.length; ++i) {
                            let holdings: Backtest.HoldingData[] = [];
                            // set stoploss for holdings     
                            previousResults['holdings'].forEach((holding) => {
                                let stoplossTarget: { [key: string]: Backtest.StoplossTargetData } = {};
                                let date = holding['buyDate'];
                                let price = prices[date];
                                let dateIndex = dates.indexOf(date);
                                // get new stoploss and targets for new options
                                setStoplossTarget(stoplossTarget, strategyOptions, price, date, atr, lows, highs, dates, dateIndex);
                                // too high to consider
                                if (high && stoplossTarget.hasOwnProperty(date) && stoplossTarget[date]['target'] && stoplossTarget[date]['target']! > high.getGraph()['High'][date]) {
                                    delete stoplossTarget[date];
                                    return;
                                }
                                let newHolding = {
                                    buyDate: date,
                                    stoplossTarget: stoplossTarget[date]
                                }
                                holdings.push(newHolding);
                            })

                            results.push({
                                'profit': profits[i]['profit'],
                                'percentProfit': profits[i]['percentProfit'] / optimizedEvents[i].length,
                                'events': optimizedEvents[i],
                                'holdings': holdings,
                                'faulty': false
                            });
                        }
                    }
                    resolve({ results, effective, count });
                }
            })
    });
}

function getOptimizedEvent(event: Backtest.EventData, buyDate: string, buyPrice: number, sellDate: string,
    sellPrice: number, reason: Backtest.EventReason, stoplossTarget: { [key: string]: Backtest.StoplossTargetData }, profit: { profit: number; percentProfit: number }) {

    let eventCopy = { ...event };
    eventCopy['reason'] = reason;
    calculateProfit(eventCopy, buyPrice, sellPrice, stoplossTarget[buyDate]);
    eventCopy['sellDate'] = sellDate;
    eventCopy['span'] = daysBetween(new Date(buyDate), new Date(sellDate));
    event['risk'] = stoplossTarget[buyDate]['risk'];

    // remove from stoplossTarget
    delete stoplossTarget[buyDate];

    // also record profits
    profit['profit'] += eventCopy['profit'];
    profit['percentProfit'] += eventCopy['percentProfit'];
    return eventCopy;
}

// given symbol, find intersections
function findIntersections(strategyOptions: Backtest.StrategyOptions, symbol: string, previousResults: Backtest.SymbolDataEntry | undefined, lastUpdated: Date | undefined) {
    return new Promise<Backtest.SymbolDataEntry>((resolve, reject) => {
        // find prices
        getPrices(symbol, strategyOptions['timeframe'])
            .then(json => {
                // if error
                if (json.hasOwnProperty('error')) {
                    reject((json as { error: string; })['error']);
                }
                // if valid prices
                else {
                    // maps date to data
                    let { prices, volumes, opens, highs, lows, closes, dates } = getAdjustedData(json as BarData[], lastUpdated, strategyOptions);

                    // get indicator objects
                    let { mainIndicator: mainBuyIndicator,
                        supportingIndicators: supportingBuyIndicators,
                        map: buyMap
                    } = getIndicatorObjects(strategyOptions, 'buy', symbol, dates, prices, opens, highs, lows, closes);
                    let { mainIndicator: mainSellIndicator,
                        supportingIndicators: supportingSellIndicators,
                        map: sellMap
                    } = getIndicatorObjects(strategyOptions, 'sell', symbol, dates, prices, opens, highs, lows, closes)

                    let stopLossIndicator = undefined; //getIndicator('SMA', { period: 180, minDuration: 3 }, symbol, dates, prices, opens, highs, lows, closes);
                    let atr = getIndicator('ATR', { period: 12 }, symbol, dates, prices, opens, highs, lows, closes);
                    let high = undefined;
                    if (strategyOptions['highPeriod']) {
                        high = getIndicator('High', { period: strategyOptions['highPeriod'] }, symbol, dates, prices, opens, highs, lows, closes);
                    }

                    // if this symbol contains faulty data
                    let faulty = false;

                    // maps a buy date to its stoploss/target
                    let stoplossTarget: { [key: string]: Backtest.StoplossTargetData } = {};

                    // store buy/sell information
                    let buyPrices: number[] = [];
                    let buyDates: string[] = [];
                    let buySignal;
                    let sellSignal;
                    let expiration = strategyOptions['expiration'];
                    let buyExpiration = expiration;
                    let sellExpiration = expiration;

                    // store buy/sell events for backtest
                    let events: Backtest.EventData[] = [];
                    let event = {} as Backtest.EventData;
                    let startIndex = 0;

                    // accumulators
                    let profit = 0;
                    let percentProfit = 0;

                    // load data from previous results
                    if (lastUpdated) {
                        // load previous hits
                        if (previousResults) {
                            events = previousResults['events'];

                            // carry over holdings to look for sells
                            previousResults['holdings'].forEach(holding => {
                                let buyDate = holding['buyDate'];
                                buyDates.push(buyDate);
                                buyPrices.push(prices[buyDate]);
                                stoplossTarget[buyDate] = holding['stoplossTarget'];
                            })

                            // carry over profits
                            profit = previousResults['profit'];
                            percentProfit = previousResults['percentProfit'] * events.length;
                        }

                        // start from the date after the last update
                        for (let i = 0; i < dates.length; ++i) {
                            let day = new Date(dates[i]);
                            day.setDate(day.getDate() + 1) // yahoo data is 1 day behind
                            day.setHours(0);
                            if (day > lastUpdated) {
                                startIndex = i;
                                break;
                            }
                        }
                        // if theres no price changes since last update
                        if (startIndex == 0) {
                            // end the backtest for this symbol
                            startIndex = dates.length;
                        }
                    }

                    // loops over dates and checks for buy signal
                    for (let i = startIndex; i < dates.length; ++i) {
                        let day = dates[i];

                        // check for faulty data
                        if (!prices[day]) {
                            faulty = true;
                            break;
                        }

                        // if main buy indicator goes off and enough volume
                        if (mainBuyIndicator.getAction(day, i, true) == Indicator.BUY && volumes[day] > strategyOptions['minVolume']) {
                            buySignal = true;
                        }
                        if (buySignal) {
                            // check each non main indicator for buy signal
                            supportingBuyIndicators.forEach(indicator => {
                                if (indicator.getAction(day, i, false) == Indicator.BUY) {
                                    buyMap[indicator.name] = true;
                                }
                            });

                            // check if all supports agree
                            let allIndicatorsBuy = true;
                            Object.keys(buyMap).forEach(indicator => {
                                if (!buyMap[indicator]) {
                                    allIndicatorsBuy = false;
                                }
                            });

                            // if all supports agree, buy the stock
                            if (allIndicatorsBuy && (buyPrices.length == 0 || strategyOptions['multipleBuys'])) {
                                setStoplossTarget(stoplossTarget, strategyOptions, prices[day], day, atr, lows, highs, dates, i);
                                if (high && stoplossTarget.hasOwnProperty(day) && stoplossTarget[day]['target']
                                    && stoplossTarget[day]['target']! > (high.getGraph() as { 'High': StockData })['High'][day]) {
                                    delete stoplossTarget[day];
                                    continue;
                                }
                                else {
                                    buyPrices.push(prices[day]);
                                    buyDates.push(day);
                                }

                                buySignal = false;
                                buyExpiration = expiration;
                                Object.keys(buyMap).forEach(indicator => {
                                    buyMap[indicator] = false;
                                });
                            }
                            else {
                                buyExpiration -= 1;
                                // look for another buy signal
                                if (buyExpiration == 0) {
                                    buySignal = false;
                                    buyExpiration = expiration;
                                    Object.keys(buyMap).forEach(indicator => {
                                        buyMap[indicator] = false;
                                    });
                                }
                            }
                        }

                        let earlyTrades = getEarlyTrades(strategyOptions, stoplossTarget, prices, highs, lows, dates, i);
                        // if stoploss indicator goes off, sell all
                        if (stopLossIndicator && stopLossIndicator.shouldStop(day) == Indicator.STOP) {
                            earlyTrades = {};
                            buyDates.forEach((bd, buyIndex) => {
                                earlyTrades[bd] = {
                                    price: prices[bd],
                                    reason: 'indicator'
                                };
                            })
                        }
                        let hasEarlyTrades = Object.keys(earlyTrades).length > 0;

                        // if stoploss triggered or main seller indicator goes off and has stocks to sell
                        if (hasEarlyTrades || (mainSellIndicator.getAction(day, i, true) == Indicator.SELL && buyPrices.length > 0)) {
                            sellSignal = true;
                        }
                        if (sellSignal) {
                            // check each non main indicator for sell signal
                            supportingSellIndicators.forEach(indicator => {
                                if (indicator.getAction(day, i, false) == Indicator.SELL) {
                                    sellMap[indicator.name] = true;
                                }
                            });

                            // check if all supports agree
                            let allIndicatorsSell = true;
                            Object.keys(sellMap).forEach(indicator => {
                                if (!sellMap[indicator]) {
                                    allIndicatorsSell = false;
                                }
                            });

                            // if all supports agree or stoploss/taret triggered, sell the stock
                            if (allIndicatorsSell || hasEarlyTrades) {
                                let newBuyPrices: number[] = [];
                                let newBuyDates: string[] = [];
                                let newStoplossTarget: { [key: string]: Backtest.StoplossTargetData } = {};

                                // sell all stocks that were bought
                                for (let i = 0; i < buyPrices.length; ++i) {
                                    let buyPrice = buyPrices[i];
                                    let buyDate = buyDates[i];
                                    let sellPrice = prices[day];

                                    // if early trades exist
                                    if (hasEarlyTrades) {
                                        // dont sell if stoploss/target not met
                                        if (!earlyTrades.hasOwnProperty(buyDate)) {
                                            if (mainSellIndicator.getAction(day, i, true) != Indicator.SELL) {
                                                newBuyPrices.push(buyPrice);
                                                newBuyDates.push(buyDate);
                                                newStoplossTarget[buyDate] = stoplossTarget[buyDate];
                                                continue;
                                            }
                                        }
                                        // adjust the sell price to stoploss/target
                                        else {
                                            if (strategyOptions['limitOrder']) {
                                                sellPrice = earlyTrades[buyDate]['price'];
                                            }
                                        }
                                        event['reason'] = earlyTrades[buyDate]['reason'];
                                    }
                                    else {
                                        event['reason'] = 'indicator';
                                    }

                                    // populate transaction information
                                    calculateProfit(event, buyPrice, sellPrice, stoplossTarget[buyDate]);
                                    event['buyDate'] = buyDate;
                                    event['sellDate'] = day;
                                    event['span'] = daysBetween(new Date(buyDate), new Date(day));
                                    if (stoplossTarget[buyDate] && stoplossTarget[buyDate]['stoploss']) {
                                        event['risk'] = stoplossTarget[buyDate]['risk'];
                                    }

                                    // calculate stats
                                    profit += event['profit'];
                                    percentProfit += event['percentProfit'];

                                    // add and create new event
                                    events.push(event);
                                    event = {} as Backtest.EventData;
                                }

                                buyPrices = newBuyPrices;
                                buyDates = newBuyDates;
                                stoplossTarget = newStoplossTarget;
                                sellSignal = false;
                                sellExpiration = expiration;
                                Object.keys(sellMap).forEach(indicator => {
                                    sellMap[indicator] = false;
                                });
                            }
                            else {
                                sellExpiration -= 1;
                                // look for another sell signal
                                if (sellExpiration == 0) {
                                    sellSignal = false;
                                    sellExpiration = expiration;
                                    Object.keys(sellMap).forEach(indicator => {
                                        sellMap[indicator] = false;
                                    });
                                }
                            }
                        }
                    };

                    // store holdings information
                    let holdings: Backtest.HoldingData[] = [];
                    buyDates.forEach(bd => {
                        holdings.push({
                            buyDate: bd,
                            stoplossTarget: stoplossTarget[bd]
                        })
                    })

                    resolve({ 'profit': profit, 'percentProfit': percentProfit / events.length, 'events': events, 'holdings': holdings, 'faulty': faulty });
                }
            });
    })
}
//#endregion

//#region Helper Functions
// gets the symbols from cache or from csv
function getSymbols(applyBlacklist: boolean) {
    return new Promise<string[]>((resolve, reject) => {
        // read blacklist symbols (faulty data)
        let blacklist: string[] = [];
        if (fs.existsSync(PATH_TO_BLACKLIST)) {
            blacklist = JSON.parse(fs.readFileSync(PATH_TO_BLACKLIST, { encoding: 'utf-8' }));
        }
        // read from cache
        if (fs.existsSync(PATH_TO_SYMBOLS) && useCache) {
            console.log('Loading Symbols from Cache...');
            let symbols: string[] = JSON.parse(fs.readFileSync(PATH_TO_SYMBOLS, { encoding: 'utf-8' }));
            // filter out blacklist symbols
            if (applyBlacklist) {
                symbols = symbols.filter(s => !blacklist.includes(s));
            }
            resolve(symbols);
        }
        // parse info from csv
        else {
            console.log('Loading Symbols from CSV...');
            let symbols: string[] = [];
            let finished = 0;

            EXCHANGES.forEach(exchange => {
                let csvPath = path.join(__dirname, `../../res/${exchange}.csv`);
                let data = fs.readFileSync(csvPath, { encoding: 'utf-8' });

                // parse data
                csv.parse.default(data, {
                    comment: '#'
                }, function (err, output) {
                    // 'Symbol','Name','LastSale','MarketCap','IPOyear','Sector','industry','Summary Quote'
                    let labels = output.shift();

                    output.forEach((stock: string[]) => {
                        let symbol = stock[0];
                        // exclude index and sub stocks
                        if (!symbol.includes('.') && !symbol.includes('^') && !symbol.includes('~')) {
                            if (applyBlacklist && blacklist.includes(symbol)) {
                                return;
                            }
                            symbols.push(symbol.trim());
                        }
                    })

                    // if all exchanges are finished
                    if (++finished == EXCHANGES.length) {
                        // sort so its easier to check progress
                        symbols.sort();
                        console.log('Writing', symbols.length, 'Symbols to cache!');
                        // Write to cache
                        fs.writeFileSync(PATH_TO_SYMBOLS, JSON.stringify(symbols), { encoding: 'utf-8' });
                        resolve(symbols);
                    }
                })
            })
        }
    });
}

// create indicator objects from options
function getIndicatorObjects(strategyOptions: Backtest.StrategyOptions, type: 'buy' | 'sell', symbol: string, dates: string[],
    prices: StockData, opens: StockData, highs: StockData, lows: StockData, closes: StockData) {
    let mainIndicator: Indicator = null!;
    let supportingIndicators: Indicator[] = [];
    let map: { [key: string]: boolean } = {};

    type IndicatorTypes = 'buyIndicators' | 'sellIndicators';
    type MainIndicatorTypes = 'mainBuyIndicator' | 'mainSellIndicator';

    (Object.keys(strategyOptions[(type + 'Indicators') as IndicatorTypes]) as IndicatorTypes.IndicatorNames[]).forEach(indicatorName => {
        let indicatorOptions = strategyOptions[(type + 'Indicators') as IndicatorTypes][indicatorName as keyof (IndicatorTypes.Indicators)];
        let indicator = getIndicator(indicatorName, indicatorOptions, symbol, dates, prices, opens, highs, lows, closes);

        // track buy indicators
        if (indicatorName == strategyOptions[('main' + type[0].toUpperCase() + type.slice(1) + 'Indicator') as MainIndicatorTypes]) {
            mainIndicator = indicator;
        }
        else {
            supportingIndicators.push(indicator);
            map[indicatorName] = false;
        }
    });

    return { mainIndicator, supportingIndicators, map };
}

// calculate stoplosses and targets
function setStoplossTarget(stoplossTarget: { [key: string]: Backtest.StoplossTargetData }, strategyOptions: Backtest.StrategyOptions, buyPrice: number,
    buyDate: string, atr: Indicator, lows: StockData, highs: StockData, dates: string[], dateIndex: number) {
    let stoploss = undefined;
    let target = undefined;

    // use ATR for stoploss
    if (strategyOptions['stopLossAtr'] != undefined) {
        let multiplier = strategyOptions['stopLossAtr'];
        let low = lows[buyDate];

        // use swing lows
        if (strategyOptions['stoplossSwing']) {
            // price of a swing low
            let swingRange = 7;

            // find swing low within range
            for (let i = dateIndex - 1; i >= Math.max(0, dateIndex - swingRange); --i) {
                let l = lows[dates[i]];
                if (l < low) {
                    low = l;
                }
            }
        }

        // below low - atr * multiplyer 
        let sl = low - multiplier * (atr.getValue(buyDate) as number);
        stoploss = sl;
    }

    // set target based on stoploss
    if (stoploss && strategyOptions['riskRewardRatio'] != undefined) {
        let ratio = strategyOptions['riskRewardRatio'];
        target = buyPrice + ratio * (buyPrice - stoploss);
    }

    if (stoploss || target) {
        let entry: Backtest.StoplossTargetData = {};
        entry['initStoploss'] = stoploss;
        entry['stoploss'] = stoploss;
        entry['target'] = target;
        if (entry['stoploss']) {
            entry['risk'] = (buyPrice - stoploss!) / buyPrice * 100;
        }
        if (target && strategyOptions['trailingStopLoss']) {
            entry['midPoint'] = (target + buyPrice) / 2;
            entry['midPointReached'] = false;
        }
        stoplossTarget[buyDate] = entry;
    }
    else {
        stoplossTarget[buyDate] = {};
    }
}

// sell stocks prematurely
function getEarlyTrades(strategyOptions: Backtest.StrategyOptions, stoplossTarget: { [key: string]: Backtest.StoplossTargetData },
    prices: StockData, highs: StockData, lows: StockData, dates: string[], dateIndex: number) {
    // map buy date to sell price
    let earlyTrades: { [key: string]: { price: number; reason: Backtest.EventReason; } } = {};
    let day = dates[dateIndex];
    let price = prices[day];
    let high = highs[day];
    let low = lows[day];

    // check if prices breach stoploss/targets
    Object.keys(stoplossTarget).forEach((bd) => {
        // cannot sell on the same day as buy
        if (bd == day || !stoplossTarget[bd]) return;
        let stoploss = stoplossTarget[bd]['stoploss'];
        let target = stoplossTarget[bd]['target'];
        let midPoint = stoplossTarget[bd]['midPoint'];
        // if tie between stoploss and target, take stoploss (worse case)
        if (target && high > target) {
            earlyTrades[bd] = {
                price: target,
                reason: 'target'
            };
        }
        if (stoploss && low < stoploss) {
            earlyTrades[bd] = {
                price: stoploss,
                reason: 'stoploss'
            }
        }
        if (midPoint && !stoplossTarget[bd]['midPointReached'] && high > midPoint) {
            stoplossTarget[bd]['midPointReached'] = true;
            stoplossTarget[bd]['stoploss'] = prices[bd];
        }
    });

    // overdue stocks
    if (strategyOptions['maxDays']) {
        Object.keys(stoplossTarget).forEach((bd) => {
            if (daysBetween(new Date(bd), new Date(day)) > strategyOptions['maxDays']) {
                earlyTrades[bd] = {
                    price: price,
                    reason: 'overdue'
                };
            }
        });
    }

    return earlyTrades;
}

function calculateProfit(event: Backtest.EventData, buyPrice: number, sellPrice: number, stoplossTarget: Backtest.StoplossTargetData) {
    // use trailing stop
    if (stoplossTarget && stoplossTarget['midPoint']) {
        // target met, take 1.5
        if (event['reason'] == 'target') {
            event['profit'] = (sellPrice - buyPrice) * .75;
            event['percentProfit'] = event['profit'] / buyPrice;
            return;
        }
        // stoploss met, loss depends on if midpoint was reached
        else if (event['reason'] == 'stoploss') {
            if (stoplossTarget['midPointReached']) {
                event['profit'] = (stoplossTarget['midPoint'] - buyPrice) * .5;
                event['percentProfit'] = event['profit'] / buyPrice;
                return;
            }
        }
        // indicator or overdue
        else {
            if (stoplossTarget['midPointReached']) {
                event['profit'] = (sellPrice - buyPrice + stoplossTarget['midPoint'] - buyPrice) * .5;
                event['percentProfit'] = event['profit'] / buyPrice;
                return;
            }
        }
    }

    // simple case
    event['profit'] = sellPrice - buyPrice;
    event['percentProfit'] = (sellPrice - buyPrice) / buyPrice;
}
//#endregion

export {
    backtest, optimizeStoplossTarget, optimizeIndicators, updateBacktest, getActionsToday,
    conductBacktest, conductStoplossTargetOptimization, conductIndicatorOptimization,
    findIntersections, optimizeStoplossTargetForSymbol, optimizeIndicatorsForSymbol,
    getSymbols, getIndicator
};