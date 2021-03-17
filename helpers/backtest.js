let fetch = require('node-fetch');
var path = require('path');
var fs = require('fs');
let sizeof = require('object-sizeof')
const { fork } = require('child_process');
const sgMail = require('@sendgrid/mail');

// own helpers
const csv = require('csv');
let { fixFaulty, getPrices } = require('../helpers/stock');
let { getDocument, setDocumentField, addDocument } = require('../helpers/mongo');
let { daysBetween, getBacktestSummary } = require('../helpers/utils');
let { sortResultsByScore } = require('../client/src/helpers/utils');
let { triggerChannel } = require('../helpers/pusher');
let { addJob } = require('../helpers/queue');
let { cancelAllBuyOrders, requestBracketOrder, changeAccount, requestMarketOrderSell } = require('./alpaca');

// indicators
let SMA = require('../helpers/indicators/sma');
let EMA = require('../helpers/indicators/ema');
let RSI = require('../helpers/indicators/rsi');
let MACD = require('../helpers/indicators/macd');
let MACDPos = require('../helpers/indicators/macdPos');
let GC = require('../helpers/indicators/gc');
let ADX = require('../helpers/indicators/adx');
let Solid = require('../helpers/indicators/solid');
let Candle = require('./indicators/candle');
let Structure = require('../helpers/indicators/structure');
let ATR = require('../helpers/indicators/atr');
let Pullback = require('../helpers/indicators/pullback');
let Breakout = require('../helpers/indicators/breakout');
let Swing = require('../helpers/indicators/swing');
let Divergence = require('../helpers/indicators/divergence');
let Stochastic = require('../helpers/indicators/stochastic');
let Trend = require('../helpers/indicators/trend');
let Indicator = require('../helpers/indicators/indicator');
let INDICATOR_OBJECTS = {
    "SMA": SMA,
    "EMA": EMA,
    "RSI": RSI,
    "MACD": MACD,
    "MACD2": MACDPos,
    "GC": GC,
    "ADX": ADX,
    "Solid": Solid,
    "Candle": Candle,
    "Structure": Structure,
    "ATR": ATR,
    "Pullback": Pullback,
    "Breakout": Breakout,
    "Swing": Swing,
    "Divergence": Divergence,
    "Stochastic": Stochastic,
    "Trend": Trend
}

// paths to resources
let PATH_TO_SYMBOLS = path.join(__dirname, "../res/symbols.json");
let PATH_TO_FAULTY = path.join(__dirname, "../res/faulty.json");
let PATH_TO_BLACKLIST = path.join(__dirname, "../res/blacklist.json");

// only get symbols from these exchanges
let EXCHANGES = ["amex", "nasdaq", "nyse"];

// cache settings
const useCache = true;

//#region Subscribed Backtests
// get actions today for a backtest
async function getActionsToday(id, email) {
    return addJob(() => {
        return new Promise(async resolveJob => {
            let doc = await getDocument("results", id);
            let symbols = Object.keys(doc["results"]["symbolData"]);
            let userDoc = await getDocument("users", email);
            let watchlist = Object.keys(userDoc["buys"]);
            let today = new Date();
            let actions = { buy: [], sell: [] };
            let buyData = {};
            let sellData = {};
            let alpacaCredentials = userDoc["alpaca"];
            let useAlpaca = alpacaCredentials["id"].length > 0 && alpacaCredentials["key"].length > 0;
            let tradeSettings = userDoc["tradeSettings"][id];

            console.log(`Getting actions for id: ${id}, alpaca: ${useAlpaca}`)

            // look for buy and sell symbols
            for (let i = 0; i < symbols.length; ++i) {
                let symbol = symbols[i];
                let symbolData = doc["results"]["symbolData"][symbol];
                let events = symbolData["events"];
                let lastEvent = events.length > 0 ? events[events.length - 1] : undefined;

                // look through holdings for buy actions  
                let holdings = symbolData["holdings"];
                if (holdings.length > 0 && daysBetween(today, new Date(holdings[holdings.length - 1]["buyDate"])) == 0) {
                    actions["buy"].push(symbol);
                    buyData[symbol] = {
                        holding: holdings[holdings.length - 1]
                    }
                }

                // look at last event for sell actions
                if (watchlist.includes(symbol) && lastEvent && daysBetween(today, new Date(lastEvent["sellDate"])) == 0) {
                    actions["sell"].push(symbol);
                    sellData[symbol] = {
                        event: lastEvent
                    }
                }
            }

            if (useAlpaca) {
                // change accounts using credentials
                changeAccount(alpacaCredentials);
                // clear all alpaca buy orders carried over from previous day
                await cancelAllBuyOrders();

                // execute alpaca orders for buys
                let scoreBy = (tradeSettings && tradeSettings["scoreBy"]) ? tradeSettings["scoreBy"] : "Percent Profit";
                let sortedSymbols = sortResultsByScore(doc["results"], scoreBy);
                actions["buy"].sort((a, b) => sortedSymbols.indexOf(a) - sortedSymbols.indexOf(b))

                actions["buy"].forEach(async buySymbol => {
                    let holding = buyData[buySymbol]["holding"];
                    // qualify for bracket orders
                    if (holding["stoplossTarget"]) {
                        // add to alpaca
                        let risk = holding["stoplossTarget"]["risk"];
                        let stoploss = holding["stoplossTarget"]["stoploss"];
                        let target = holding["stoplossTarget"]["target"];
                        let buyPrice = stoploss / (1 - risk / 100);
                        let positionSize = .05;
                        let shouldTrade = true;

                        // adjust parameters
                        if (tradeSettings) {
                            if (tradeSettings["maxRisk"]) shouldTrade = risk <= parseInt(tradeSettings["maxRisk"]);
                            if (tradeSettings["maxPositions"]) positionSize = 1 / (parseInt(tradeSettings["maxPositions"]));
                        }

                        if (shouldTrade) {
                            try {
                                await requestBracketOrder(buySymbol, buyPrice, positionSize, stoploss, target);
                            }
                            catch (e) {
                                console.log(e["message"])
                                // insufficient buying power                            
                            }
                        }
                    }
                })

                // execute alpaca orders for sells (overdue)
                actions["sell"].forEach(async sellSymbol => {
                    if (sellData[sellSymbol]["event"]["reason"] == "overdue") {
                        await requestMarketOrderSell(sellSymbol);
                    }
                })
            }

            console.log(`#Buys: ${actions["buy"].length}, #Sells: ${actions["sell"].length}`)

            // only send email if there are stocks to sell or bought stocks in alpaca
            if (actions["sell"].length + actions["buy"].length > 0) {
                let text = "";
                if (actions["sell"].length > 0) {
                    text += `Symbols to sell:\n` +
                        `${actions["sell"].join("\n")}\n` +
                        `View at ${process.env.DOMAIN}/${id}\n`;
                }
                if (actions["buy"].length > 0) {
                    if (useAlpaca) {
                        text += `Buy orders sent to Alpaca:\n` +
                            `${actions["buy"].join("\n")}\n` +
                            `View at https://app.alpaca.markets/paper/dashboard/overview\n`;
                    }
                    else {
                        text += `Symbols to sell:\n
                    ${actions["sell"].join("\n")}
                    View at ${process.env.DOMAIN}/${id}\n`;
                    }
                }

                // send email
                sgMail.setApiKey(process.env.SENDGRID_API_KEY);
                const msg = {
                    to: email,
                    from: "backtest@updated.com",
                    subject: "Stock Updates!",
                    text: text
                };
                sgMail.send(msg)
                    .then(() => console.log("Email sent to", email))
                    .catch(function (err) {
                        console.log(err);
                        console.log(err["response"]["body"]["errors"])
                    })
            }
            else {
                console.log("No email sent")
            }
            resolveJob();
        })
    });
}
//#endregion

//#region Queue Jobs
// queues a backtest
function backtest(id, strategyOptions) {
    return addJob(() => {
        return new Promise(async resolveJob => {
            // spawn child to do work
            let child = fork(path.join(__dirname, "../helpers/worker.js"));
            child.send({ type: "startBacktest", strategyOptions, id });
            child.on('message', async function (message) {
                console.log(message);
                if (message.status == "finished") {
                    console.log("Trigger client", id);
                    triggerChannel(id, "onResultsFinished", { id: `${id}` });

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
function updateBacktest(id) {
    return addJob(() => {
        return new Promise(async resolveJob => {
            let doc = await getDocument("results", id);
            // same day needs no update
            if (daysBetween(new Date(doc["lastUpdated"]), new Date()) < 1) {
                resolveJob();
                return;
            }
            // already updating, probably not needed because of check above
            else if (doc["status"] == "updating") {
                // resolveJob();
                // return;
            }

            setDocumentField("results", id, "status", "updating");
            let strategyOptions = doc["results"]["strategyOptions"];

            // spawn child to do work
            let child = fork(path.join(__dirname, "../helpers/worker.js"));
            child.send({ type: "startBacktest", strategyOptions, id });
            child.on('message', function (message) {
                if (message.status == "finished") {
                    setDocumentField("results", id, "status", "ready");
                    console.log("Trigger client", id);
                    triggerChannel(id, "onUpdateFinished", { id: `${id}` });
                    resolveJob();
                }
            });
        });
    });
}

// queues an optimization
function optimizeStoplossTarget(id, optimizeOptions) {
    let maxResults = 15;
    let totalRatios = (optimizeOptions["endRatio"] - optimizeOptions["startRatio"]) / optimizeOptions["strideRatio"];
    if (totalRatios > maxResults) {
        optimizeOptions["endRatio"] = optimizeOptions["startRatio"] + optimizeOptions["strideRatio"] * (maxResults - 1);
    }
    let position = undefined;
    // make a job for each stoploss option
    for (let stoploss = optimizeOptions["startStoploss"]; stoploss < optimizeOptions["endStoploss"]; stoploss += optimizeOptions["strideStoploss"]) {
        let optimizeOptionsCopy = { ...optimizeOptions };
        optimizeOptionsCopy["startStoploss"] = stoploss;
        optimizeOptionsCopy["endStoploss"] = stoploss + optimizeOptions["strideStoploss"];
        let p = addJob(() => {
            return new Promise(async resolveJob => {
                // spawn child to do work
                let child = fork(path.join(__dirname, "../helpers/worker.js"));
                child.send({ type: "startOptimizeStoplossTarget", id, optimizeOptions: optimizeOptionsCopy });
                child.on('message', async function (message) {
                    if (message.status == "finished") {
                        console.log("Trigger client", id);
                        triggerChannel(id, "onOptimizeFinished", { id: `${id}` });
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
function optimizeIndicators(id, indicatorOptions) {
    return addJob(() => {
        return new Promise(async resolveJob => {
            // spawn child to do work
            let child = fork(path.join(__dirname, "../helpers/worker.js"));
            child.send({ type: "startOptimizeIndicators", id, indicatorOptions });
            child.on('message', async function (message) {
                if (message.status == "finished") {
                    console.log("Trigger client", id);
                    triggerChannel(id, "onOptimizeIndicatorsFinished", { id: `${id}` });
                    resolveJob();
                }
            });
        });
    });
}
//#endregion

//#region Conduct Workers
// conduct a backtest with given strategy
function conductBacktest(strategyOptions, id) {
    return new Promise(resolve => {
        // get list of symbols to query
        getSymbols(true).then(async (symbols) => {
            // Uncomment to test a portion of symbols
            // symbols = symbols.slice(0, 50);
            // Uncoment to test custom symbols CHANGEBACK
            // symbols = ["WERN"];

            // try to get previous results
            let previousResults = await getDocument("results", id);
            if (typeof (previousResults["results"]) == "string") {
                previousResults = undefined;
            }
            // maps symbol to buy/sell data
            let intersections = {};

            // create threads that split up the work
            let finishedWorkers = 0;
            let partitionSize = Math.ceil(symbols.length / process.env.NUM_THREADS);
            let progress = 0;
            for (let i = 0; i < process.env.NUM_THREADS; ++i) {
                // divy up the symbols for each thread to work on
                let partition = symbols.slice(i * partitionSize, (i + 1) * partitionSize);

                // spawn child to do work
                let child = fork(path.join(__dirname, "worker.js"));
                child.on('message', async (msg) => {
                    if (msg.status == "finished") {
                        // assign partition's results to collective results
                        Object.assign(intersections, msg.intersections);
                        // if all worker threads are finished
                        if (++finishedWorkers == process.env.NUM_THREADS) {
                            // check for faulty data
                            let faulty = [];
                            if (fs.existsSync(PATH_TO_FAULTY)) {
                                faulty = JSON.parse(fs.readFileSync(PATH_TO_FAULTY, { encoding: "utf-8" }));
                                Object.keys(intersections).forEach(symbol => {
                                    if (intersections[symbol]["faulty"] && !faulty.includes(symbol)) {
                                        faulty.push(symbol);
                                    }
                                })
                            }
                            // save faulty list
                            fs.writeFileSync(PATH_TO_FAULTY, JSON.stringify(faulty), { encoding: "utf-8" });

                            let results = {
                                strategyOptions, symbolData: intersections, lastUpdated: new Date(),
                                created: previousResults ? previousResults["results"]["created"] : new Date()
                            };
                            // add result to database
                            await setDocumentField("results", id, "summary", getBacktestSummary(results));
                            let err = await setDocumentField("results", id, "results", results, { subField: "symbolData" });
                            if (err) console.log(err);
                            resolve();
                        }
                    }
                    if (msg.status == "progress") {
                        progress += msg.progress;
                        triggerChannel(id, "onProgressUpdate", { progress: 100 * progress / symbols.length });
                    }
                })
                child.send({ type: "backtestJob", strategyOptions, id, previousResults, partition });
            }
        });
    })
}

// conduct an optimization with optimize options
function conductStoplossTargetOptimization(id, optimizeOptions) {
    return new Promise(async (resolve, reject) => {
        // try to get previous results
        let previousResults = await getDocument("results", id);
        if (typeof (previousResults["results"]) == "string") {
            reject("Optimize Error: Backtest results does not exist!");
            return;
        }

        // list of results
        let results = [];
        let strategyOptions = previousResults["results"]["strategyOptions"];
        let newIDs = [];
        // fill in skeleton
        for (let stoploss = optimizeOptions["startStoploss"]; stoploss < optimizeOptions["endStoploss"]; stoploss += optimizeOptions["strideStoploss"]) {
            for (let ratio = optimizeOptions["startRatio"]; ratio < optimizeOptions["endRatio"]; ratio += optimizeOptions["strideRatio"]) {
                let strategyOptionsCopy = { ...strategyOptions };
                strategyOptionsCopy["stopLossAtr"] = stoploss;
                strategyOptionsCopy["riskRewardRatio"] = ratio;
                results.push({
                    strategyOptions: strategyOptionsCopy,
                    symbolData: {},
                    lastUpdated: previousResults["results"]["lastUpdated"],
                    created: previousResults["results"]["created"]
                })
                newIDs.push(`${id}_optimized_${stoploss.toFixed(2)}_${ratio.toFixed(2)}`);
            }
        }

        // create threads that split up the work
        let finishedWorkers = 0;
        let symbols = Object.keys(previousResults["results"]["symbolData"]);
        let partitionSize = Math.ceil(symbols.length / process.env.NUM_THREADS);
        let progress = 0;
        for (let i = 0; i < process.env.NUM_THREADS; ++i) {
            // divy up the symbols for each thread to work on
            let partition = symbols.slice(i * partitionSize, (i + 1) * partitionSize);

            // spawn child to do work
            let child = fork(path.join(__dirname, "worker.js"));
            child.on('message', async (msg) => {
                if (msg.status == "finished") {
                    console.log("WORKER FINISHED");
                    // enter optimized data into results
                    let optimizedData = msg.optimizedData;
                    Object.keys(optimizedData).forEach(symbol => {
                        optimizedData[symbol].forEach((symbolData, i) => {
                            results[i]["symbolData"][symbol] = symbolData;
                        });
                    });

                    // if all worker threads are finished
                    if (++finishedWorkers == process.env.NUM_THREADS) {
                        console.log("Finished optimization.");
                        // add result to database
                        for (let resultsIndex = 0; resultsIndex < results.length; resultsIndex++) {
                            console.log("Adding result #" + resultsIndex);
                            let newID = newIDs[resultsIndex];
                            // create a new document for each combination
                            await addDocument("results", { _id: newID });
                            // fill in the document
                            await setDocumentField("results", newID, "summary", getBacktestSummary(results[resultsIndex]));
                            await setDocumentField("results", newID, "results", results[resultsIndex], { subField: "symbolData" });
                            // link optimized to base
                            await setDocumentField("results", newID, "_optimized", { base: id });
                        }

                        // store more info in base
                        let optimizedIDs = [];
                        if (previousResults["_optimized"] && previousResults["_optimized"]["ids"]) {
                            optimizedIDs = previousResults["_optimized"]["ids"];
                        }
                        newIDs.forEach(newID => {
                            if (!optimizedIDs.includes(newID)) {
                                optimizedIDs.push(newID);
                            }
                        });

                        await setDocumentField("results", id, "_optimized", { base: id, ids: optimizedIDs });
                        resolve();
                    }
                }
                if (msg.status == "progress") {
                    progress += msg.progress;
                    triggerChannel(id, "onOptimizeProgressUpdate", { progress: 100 * progress / symbols.length });
                }
            })
            child.send({ type: "optimizeStoplossTargetJob", partition, id, previousResults, optimizeOptions });
        }
    })
}

function conductIndicatorOptimization(id, indicatorOptions) {
    return new Promise(async (resolve, reject) => {
        let previousResults = await getDocument("results", id);

        // create threads that split up the work
        let finishedWorkers = 0;
        let symbols = Object.keys(previousResults["results"]["symbolData"]); //.slice(0, 50);
        let partitionSize = Math.ceil(symbols.length / process.env.NUM_THREADS);
        let progress = 0;
        let indicatorData = {};
        for (let i = 0; i < process.env.NUM_THREADS; ++i) {
            // divy up the symbols for each thread to work on
            let partition = symbols.slice(i * partitionSize, (i + 1) * partitionSize);

            // spawn child to do work
            let child = fork(path.join(__dirname, "worker.js"));
            child.on('message', async (msg) => {
                if (msg.status == "finished") {
                    // accumulate worker's data
                    Object.assign(indicatorData, msg.optimizedData);

                    // if all worker threads are finished
                    if (++finishedWorkers == process.env.NUM_THREADS) {
                        // enter data into indicator collection 
                        await addDocument("indicators", { _id: id });
                        // fill in the document
                        await setDocumentField("indicators", id, "data", indicatorData, {});
                        resolve();
                    }
                }
                if (msg.status == "progress") {
                    progress += msg.progress;
                    triggerChannel(id, "onOptimizeIndicatorsProgressUpdate", { progress: 100 * progress / symbols.length });
                }
            })
            child.send({ type: "optimizeIndicatorsJob", partition, id, previousResults, indicatorOptions });
        }
    });
}
//#endregion

//#region Worker Functions
// given an existing backtest, record all the indicator data
function optimizeIndicatorsForSymbol(indicatorOptions, symbol, results, strategyOptions) {
    return new Promise((resolve, reject) => {
        let indicatorFields = undefined;
        getPrices(symbol, strategyOptions["timeframe"])
            .then(json => {
                // if error
                if (json["error"]) {
                    reject(json["error"]);
                }
                // if valid prices
                else {
                    // get price and indicator setup
                    let [prices, volumes, opens, highs, lows, closes, dates] = getAdjustedData(json, undefined);
                    let indicators = {};
                    let indicatorNames = Object.keys(indicatorOptions);
                    indicatorNames.forEach(indicatorName => {
                        indicators[indicatorName] = getIndicator(indicatorName, indicatorOptions[indicatorName], symbol, dates, prices, opens, highs, lows, closes);
                    });

                    let indicatorData = [];
                    // record indicator values at every event
                    results["events"].forEach(event => {
                        let buyDate = event["buyDate"];
                        let data = {};

                        // record data from each indicator
                        indicatorNames.forEach(indicatorName => {
                            let value = indicators[indicatorName].getValue(buyDate);
                            if (typeof (value) == "number") {
                                data[indicatorName] = value;
                            }
                            else if (typeof (value) == "object") {
                                Object.keys(value).forEach(key => {
                                    data[key] = value[key];
                                })
                            }
                        });
                        data["Price"] = prices[buyDate];

                        // flatten the data to an array
                        if (!indicatorFields) {
                            indicatorFields = Object.keys(data).sort();
                        }
                        let flattenedData = indicatorFields.map(f => data[f]);
                        indicatorData.push({ indicators: flattenedData, percentProfit: event["percentProfit"], buyDate: buyDate });
                    });

                    resolve({ data: indicatorData, fields: indicatorFields });
                }
            });
    });
}

// given an existing backtest, apply different stoploss/target options
function optimizeStoplossTargetForSymbol(strategyOptions, optimizeOptions, symbol, previousResults) {
    return new Promise((resolve, reject) => {
        getPrices(symbol, strategyOptions["timeframe"])
            .then(json => {
                // if error
                if (json["error"]) {
                    reject(json["error"]);
                }
                // if valid prices
                else {
                    // maps date to data
                    let [prices, volumes, opens, highs, lows, closes, dates] = getAdjustedData(json, undefined);
                    let [mainSellIndicator, supportingSellIndicators, sellMap] = getIndicatorObjects(strategyOptions, "sell", symbol, dates, prices, opens, highs, lows, closes)
                    let atr = getIndicator("ATR", { period: 12 }, symbol, dates, prices, opens, highs, lows, closes);
                    // list of symbol data for each stoploss/target combination  
                    let results = [];
                    let count = 0;
                    let effective = 0;

                    let events = previousResults["events"];
                    for (let stoploss = optimizeOptions["startStoploss"]; stoploss < optimizeOptions["endStoploss"]; stoploss += optimizeOptions["strideStoploss"]) {
                        strategyOptions["stopLossAtr"] = stoploss;
                        // length is equal to number of ratio combinations
                        let optimizedEvents = [];
                        let profits = [];
                        let stoplossTargets = [];

                        // initialization for each ratio combination
                        for (let ratio = optimizeOptions["startRatio"]; ratio < optimizeOptions["endRatio"]; ratio += optimizeOptions["strideRatio"]) {
                            optimizedEvents.push([]);
                            profits.push({ profit: 0, percentProfit: 0 });
                            stoplossTargets.push({});
                        }

                        // go through each buy event
                        for (let eventIndex = 0; eventIndex < events.length; ++eventIndex) {
                            let event = events[eventIndex];
                            let date = event["buyDate"];
                            let dateIndex = dates.indexOf(date);
                            let price = prices[date];
                            let buyDate = event["buyDate"];
                            let buyPrice = prices[buyDate];
                            count += optimizedEvents.length;

                            if (dateIndex == -1) {
                                continue;
                            }

                            // ignore events that were sold because of indicator
                            if (event["reason"] == "indicator") {
                                optimizedEvents.forEach(oe => oe.push(event));
                                continue;
                            }

                            // set stoploss/target for all ratio combinations
                            let sold = [];
                            let soldCount = stoplossTargets.length;
                            let index = 0;
                            for (let ratio = optimizeOptions["startRatio"]; ratio < optimizeOptions["endRatio"]; ratio += optimizeOptions["strideRatio"]) {
                                strategyOptions["riskRewardRatio"] = ratio;
                                let stoplossTarget = stoplossTargets[index];
                                setStoplossTarget(stoplossTarget, strategyOptions, price, date, atr, lows, highs, dates, dateIndex);
                                sold.push(false);
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
                                            let eventCopy = getOptimizedEvent(event, buyDate, buyPrice, day, sellPrice, "indicator", stoplossTargets[i], profits[i]);
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
                                            if (strategyOptions["limitOrder"]) {
                                                sellPrice = earlyTrades[buyDate]["price"];
                                            }
                                            let eventCopy = getOptimizedEvent(event, buyDate, buyPrice, day, sellPrice, earlyTrades[buyDate]["reason"], stoplossTargets[i], profits[i]);
                                            optimizedEvents[i].push(eventCopy);
                                            sold[i] = true;
                                            soldCount -= 1;
                                            if (eventCopy["reason"] != event["reason"]) {
                                                effective += 1;
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // append list of symboldata to results 
                        for (let i = 0; i < optimizedEvents.length; ++i) {
                            results.push({
                                "profit": profits[i]["profit"],
                                "percentProfit": profits[i]["percentProfit"] / optimizedEvents[i].length,
                                "events": optimizedEvents[i],
                                "holdings": previousResults["holdings"],
                                "faulty": false
                            });
                        }
                    }
                    resolve({ results, effective, count });
                }
            })
    });
}

function getOptimizedEvent(event, buyDate, buyPrice, sellDate, sellPrice, reason, stoplossTarget, profit) {
    let eventCopy = { ...event };
    eventCopy["reason"] = reason;
    calculateProfit(eventCopy, buyPrice, sellPrice, stoplossTarget[buyDate]);
    eventCopy["sellDate"] = sellDate;
    eventCopy["span"] = daysBetween(new Date(buyDate), new Date(sellDate));
    event["risk"] = stoplossTarget[buyDate]["risk"];

    // remove from stoplossTarget
    delete stoplossTarget[buyDate];

    // also record profits
    profit["profit"] += eventCopy["profit"];
    profit["percentProfit"] += eventCopy["percentProfit"];
    return eventCopy;
}

// given symbol, find intersections
function findIntersections(strategyOptions, symbol, previousResults, lastUpdated) {
    return new Promise((resolve, reject) => {
        // find prices
        getPrices(symbol, strategyOptions["timeframe"])
            .then(json => {
                // if error
                if (json["error"]) {
                    reject(json["error"]);
                }
                // if valid prices
                else {
                    // maps date to data
                    let [prices, volumes, opens, highs, lows, closes, dates] = getAdjustedData(json, lastUpdated, strategyOptions);

                    // get indicator objects
                    let [mainBuyIndicator, supportingBuyIndicators, buyMap] = getIndicatorObjects(strategyOptions, "buy", symbol, dates, prices, opens, highs, lows, closes);
                    let [mainSellIndicator, supportingSellIndicators, sellMap] = getIndicatorObjects(strategyOptions, "sell", symbol, dates, prices, opens, highs, lows, closes)
                    let stopLossIndicator = undefined; //getIndicator("SMA", { period: 180, minDuration: 3 }, symbol, dates, prices, opens, highs, lows, closes);
                    let atr = getIndicator("ATR", { period: 12 }, symbol, dates, prices, opens, highs, lows, closes);

                    // if this symbol contains faulty data
                    let faulty = false;

                    // maps a buy date to its stoploss/target
                    let stoplossTarget = {};

                    // store buy/sell information
                    let buyPrices = [];
                    let buyDates = [];
                    let buySignal;
                    let sellSignal;
                    let expiration = strategyOptions["expiration"];
                    let buyExpiration = expiration;
                    let sellExpiration = expiration;

                    // store buy/sell events for backtest
                    let events = [];
                    let event = {};
                    let startIndex = 0;

                    // accumulators
                    let profit = 0;
                    let percentProfit = 0;

                    // load data from previous results
                    if (lastUpdated) {
                        // load previous hits
                        if (previousResults) {
                            events = previousResults["events"];

                            // carry over holdings to look for sells
                            previousResults["holdings"].forEach(holding => {
                                let buyDate = holding["buyDate"];
                                buyDates.push(buyDate);
                                buyPrices.push(prices[buyDate]);
                                stoplossTarget[buyDate] = holding["stoplossTarget"];
                            })

                            // carry over profits
                            profit = previousResults["profit"];
                            percentProfit = previousResults["percentProfit"] * events.length;
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
                        if (mainBuyIndicator.getAction(day, i, true) == Indicator.BUY && volumes[day] > strategyOptions["minVolume"]) {
                            buySignal = true;
                        }
                        if (buySignal) {
                            // check each non main indicator for buy signal
                            supportingBuyIndicators.forEach(indicator => {
                                if (indicator.getAction(day, i) == Indicator.BUY) {
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
                            if (allIndicatorsBuy && (buyPrices.length == 0 || strategyOptions["multipleBuys"])) {
                                buyPrices.push(prices[day]);
                                buyDates.push(day);
                                setStoplossTarget(stoplossTarget, strategyOptions, prices[day], day, atr, lows, highs, dates, i);
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
                                    reason: "indicator"
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
                                if (indicator.getAction(day, i) == Indicator.SELL) {
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
                                let newBuyPrices = [];
                                let newBuyDates = [];
                                let newStoplossTarget = {};

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
                                            if (strategyOptions["limitOrder"]) {
                                                sellPrice = earlyTrades[buyDate]["price"];
                                            }
                                        }
                                        event["reason"] = earlyTrades[buyDate]["reason"];
                                    }
                                    else {
                                        event["reason"] = "indicator";
                                    }

                                    // populate transaction information
                                    calculateProfit(event, buyPrice, sellPrice, stoplossTarget[buyDate]);
                                    event["buyDate"] = buyDate;
                                    event["sellDate"] = day;
                                    event["span"] = daysBetween(new Date(buyDate), new Date(day));
                                    if (stoplossTarget[buyDate] && stoplossTarget[buyDate]["stoploss"]) {
                                        event["risk"] = stoplossTarget[buyDate]["risk"];
                                    }

                                    // calculate stats
                                    profit += event["profit"];
                                    percentProfit += event["percentProfit"];

                                    // add and create new event
                                    events.push(event);
                                    event = {};
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
                    let holdings = [];
                    buyDates.forEach(bd => {
                        holdings.push({
                            buyDate: bd,
                            stoplossTarget: stoplossTarget[bd]
                        })
                    })

                    resolve({ "profit": profit, "percentProfit": percentProfit / events.length, "events": events, "holdings": holdings, "faulty": faulty });
                }
            });
    })
}
//#endregion

//#region Helper Functions
// gets the symbols from cache or from csv
function getSymbols(applyBlacklist) {
    return new Promise((resolve, reject) => {
        // read blacklist symbols (faulty data)
        let blacklist = [];
        if (fs.existsSync(PATH_TO_BLACKLIST)) {
            blacklist = JSON.parse(fs.readFileSync(PATH_TO_BLACKLIST, { encoding: "utf-8" }));
        }
        // read from cache
        if (fs.existsSync(PATH_TO_SYMBOLS) && useCache) {
            console.log("Loading Symbols from Cache...");
            let symbols = JSON.parse(fs.readFileSync(PATH_TO_SYMBOLS, { encoding: "utf-8" }));
            // filter out blacklist symbols
            if (applyBlacklist) {
                symbols = symbols.filter(s => !blacklist.includes(s));
            }
            resolve(symbols);
        }
        // parse info from csv
        else {
            console.log("Loading Symbols from CSV...");
            let symbols = [];
            let finished = 0;

            EXCHANGES.forEach(exchange => {
                let csvPath = path.join(__dirname, `../res/${exchange}.csv`);
                let data = fs.readFileSync(csvPath, { encoding: "utf-8" });

                // parse data
                csv.parse(data, {
                    comment: '#'
                }, function (err, output) {
                    // "Symbol","Name","LastSale","MarketCap","IPOyear","Sector","industry","Summary Quote"
                    let labels = output.shift();

                    output.forEach(stock => {
                        let symbol = stock[0];
                        // exclude index and sub stocks
                        if (!symbol.includes(".") && !symbol.includes("^")) {
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
                        console.log("Writing", symbols.length, "Symbols to cache!");
                        // Write to cache
                        fs.writeFileSync(PATH_TO_SYMBOLS, JSON.stringify(symbols), { encoding: "utf-8" });
                        resolve(symbols);
                    }
                })
            })
        }
    });
}

// convert raw data from api to adjusted prices for backtest
function getAdjustedData(rawData, lastUpdated, strategyOptions) {
    // maps date to closing price
    let prices = {};
    let volumes = {};
    let opens = {};
    let highs = {};
    let lows = {};
    let closes = {};

    // only get new data for update
    let cutoffIndex = 0;
    if (lastUpdated) {
        // find first index where date is greater than last updated
        for (let i = rawData.length - 1; i >= 0; --i) {
            if (rawData[i]["date"] < lastUpdated) {
                cutoffIndex = i;
                break;
            }
        }
        let flattenedValues = [];
        // find maximum values used in strategy options
        let flatten = indicator => {
            flattenedValues.push(Object.values(indicator).reduce((a, b) => a + b));
        };
        Object.values(strategyOptions["buyIndicators"]).forEach(flatten);
        Object.values(strategyOptions["sellIndicators"]).forEach(flatten);
        let margin = Math.max(...flattenedValues) + 5;
        // go back certain margin
        cutoffIndex = Math.max(0, cutoffIndex - margin);
    }

    // parse list into dictionaries
    for (; cutoffIndex < rawData.length; ++cutoffIndex) {
        let day = rawData[cutoffIndex];
        let date = new Date(day["date"]);

        let formattedDate = date.toISOString();
        prices[formattedDate] = day["close"];
        volumes[formattedDate] = day["volume"];
        opens[formattedDate] = day["open"];
        highs[formattedDate] = day["high"];
        lows[formattedDate] = day["low"];
        closes[formattedDate] = day["close"];
    };

    let dates = Object.keys(prices).sort(function (a, b) {
        return new Date(a) - new Date(b);
    });

    return [prices, volumes, opens, highs, lows, closes, dates];
}

// create indicator objects from options
function getIndicatorObjects(strategyOptions, type, symbol, dates, prices, opens, highs, lows, closes) {
    let mainIndicator;
    let supportingIndicators = [];
    let map = {};

    Object.keys(strategyOptions[type + "Indicators"]).forEach(indicatorName => {
        let indicatorOptions = strategyOptions[type + "Indicators"][indicatorName];
        let indicator = getIndicator(indicatorName, indicatorOptions, symbol, dates, prices, opens, highs, lows, closes);

        // track buy indicators
        if (indicatorName == strategyOptions["main" + type[0].toUpperCase() + type.slice(1) + "Indicator"]) {
            mainIndicator = indicator;
        }
        else {
            supportingIndicators.push(indicator);
            map[indicatorName] = false;
        }
    });

    return [mainIndicator, supportingIndicators, map];
}

// gets an indicator object
function getIndicator(indicatorName, indicatorOptions, symbol, dates, prices, opens, highs, lows, closes) {
    let indicator = new INDICATOR_OBJECTS[indicatorName](symbol, dates, prices, opens, highs, lows, closes);
    indicator.initialize(indicatorOptions);
    return indicator;
}

// calculate stoplosses and targets
function setStoplossTarget(stoplossTarget, strategyOptions, buyPrice, buyDate, atr, lows, highs, dates, dateIndex) {
    let stoploss = undefined;
    let target = undefined;

    // find static stoploss trades (deprecated in front-end)
    if (strategyOptions["stopLossLow"] != undefined) {
        stoploss = buyPrice * strategyOptions["stopLossLow"];
    }
    if (strategyOptions["stopLossHigh"] != undefined) {
        target = buyPrice * strategyOptions["stopLossHigh"];
    }

    if (strategyOptions["targetAtr"] != undefined) {
        let multiplier = strategyOptions["targetAtr"];
        target = buyPrice + multiplier * atr.getValue(buyDate);
    }

    // use ATR for stoploss
    if (strategyOptions["stopLossAtr"] != undefined) {
        let multiplier = strategyOptions["stopLossAtr"];
        let low = lows[buyDate];

        // use swing lows
        if (strategyOptions["stopLossSwing"]) {
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
        let sl = low - multiplier * atr.getValue(buyDate);
        stoploss = sl;
    }

    // set target based on stoploss
    if (stoploss && strategyOptions["riskRewardRatio"] != undefined) {
        let ratio = strategyOptions["riskRewardRatio"];
        target = buyPrice + ratio * (buyPrice - stoploss);
    }

    // use swing high instead if target is too high
    if (strategyOptions["targetSwing"]) {
        let swingRange = 26;
        let high = highs[buyDate];

        // find swing high within range
        for (let i = dateIndex - 1; i >= Math.max(0, dateIndex - swingRange); --i) {
            let h = highs[dates[i]];
            if (h > high) {
                high = h;
            }
        }

        // take the smaller of two targets
        if (target) {
            target = Math.min(target, high);
        }
        else {
            target = high;
        }
    }

    if (stoploss || target) {
        let entry = {};
        entry["initStoploss"] = stoploss;
        entry["stoploss"] = stoploss;
        entry["target"] = target;
        if (entry["stoploss"]) {
            entry["risk"] = (buyPrice - stoploss) / buyPrice * 100;
        }
        if (target && strategyOptions["trailingStopLoss"]) {
            entry["midPoint"] = (target + buyPrice) / 2;
            entry["midPointReached"] = false;
        }
        stoplossTarget[buyDate] = entry;
    }
}

// sell stocks prematurely
function getEarlyTrades(strategyOptions, stoplossTarget, prices, highs, lows, dates, dateIndex) {
    // map buy date to sell price
    let earlyTrades = {};
    let day = dates[dateIndex];
    let price = prices[day];
    let high = highs[day];
    let low = lows[day];

    // check if prices breach stoploss/targets
    Object.keys(stoplossTarget).forEach((bd) => {
        // cannot sell on the same day as buy
        if (bd == day || !stoplossTarget[bd]) return;
        let stoploss = stoplossTarget[bd]["stoploss"];
        let target = stoplossTarget[bd]["target"];
        let midPoint = stoplossTarget[bd]["midPoint"];
        // if tie between stoploss and target, take stoploss (worse case)
        if (target && high > target) {
            earlyTrades[bd] = {
                price: target,
                reason: "target"
            };
        }
        if (stoploss && low < stoploss) {
            earlyTrades[bd] = {
                price: stoploss,
                reason: "stoploss"
            }
        }
        if (midPoint && !stoplossTarget[bd]["midPointReached"] && high > midPoint) {
            stoplossTarget[bd]["midPointReached"] = true;
            stoplossTarget[bd]["stoploss"] = prices[bd];
        }
    });

    // overdue stocks
    if (strategyOptions["maxDays"]) {
        Object.keys(stoplossTarget).forEach((bd) => {
            if (daysBetween(new Date(bd), new Date(day)) > strategyOptions["maxDays"]) {
                earlyTrades[bd] = {
                    price: price,
                    reason: "overdue"
                };
            }
        });
    }

    return earlyTrades;
}

function calculateProfit(event, buyPrice, sellPrice, stoplossTarget) {
    // use trailing stop
    if (stoplossTarget && stoplossTarget["midPoint"]) {
        // target met, take 1.5
        if (event["reason"] == "target") {
            event["profit"] = (sellPrice - buyPrice) * .75;
            event["percentProfit"] = event["profit"] / buyPrice;
            return;
        }
        // stoploss met, loss depends on if midpoint was reached
        else if (event["reason" == "stoploss"]) {
            if (stoplossTarget["midPointReached"]) {
                event["profit"] = (stoplossTarget["midPoint"] - buyPrice) * .5;
                event["percentProfit"] = event["profit"] / buyPrice;
                return;
            }
        }
        // indicator or overdue
        else {
            if (stoplossTarget["midPointReached"]) {
                event["profit"] = (sellPrice - buyPrice + stoplossTarget["midPoint"] - buyPrice) * .5;
                event["percentProfit"] = event["profit"] / buyPrice;
                return;
            }
        }
    }

    // simple case
    event["profit"] = sellPrice - buyPrice;
    event["percentProfit"] = (sellPrice - buyPrice) / buyPrice;
}

// get buy or sell conditions
function getConditions(mainIndicator, supportingIndicators, date) {
    let conditions = {};
    conditions[mainIndicator.name] = mainIndicator.getValue(date);
    supportingIndicators.forEach(indicator => {
        conditions[indicator.name] = indicator.getValue(date);
    });
    return conditions
}
//#endregion

module.exports = {
    backtest, optimizeStoplossTarget, optimizeIndicators, updateBacktest, getActionsToday,
    conductBacktest, conductStoplossTargetOptimization, conductIndicatorOptimization,
    findIntersections, optimizeStoplossTargetForSymbol, optimizeIndicatorsForSymbol,
    getSymbols, getAdjustedData, getIndicator
}; 