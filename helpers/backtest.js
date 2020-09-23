let fetch = require('node-fetch');
var path = require('path');
var fs = require('fs');
const { fork } = require('child_process');

// own helpers
const csv = require('csv');
let { addResult, getDocument, containsID } = require('../helpers/mongo');
let { daysBetween, formatDate } = require('../helpers/utils');
let { triggerChannel } = require('../helpers/pusher');

// indicators
let SMA = require('../helpers/indicators/sma');
let EMA = require('../helpers/indicators/ema');
let RSI = require('../helpers/indicators/rsi');
let RSIDull = require('../helpers/indicators/rsiDull');
let MACD = require('../helpers/indicators/macd');
let MACDPos = require('../helpers/indicators/macdPos');
let GC = require('../helpers/indicators/gc');
let ADX = require('../helpers/indicators/adx');
let Solid = require('../helpers/indicators/solid');
let Hammer = require('../helpers/indicators/hammer');
let Structure = require('../helpers/indicators/structure');
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
    "Hammer": Hammer,
    "Structure": Structure
}

// paths to resources
let PATH_TO_OLD_RESULTS = path.join(__dirname, '../res/results.json');
let PATH_TO_SYMBOLS = path.join(__dirname, "../res/symbols.json");

// only get symbols from these exchanges
let EXCHANGES = ["amex", "nasdaq", "nyse"];
// get recent results within expiration date
let EXPIRATION = 5;
// get prices from today - START_DATE
let START_DATE = 365 * 100;
// how many threads to spawn on each request
const NUM_THREADS = 4;

// cache settings
const useCache = false;

// conduct a backtest with given strategy
function conductBacktest(strategyOptions, id) {
    return new Promise(resolve => {
        // get list of symbols to query
        getSymbols().then(async (symbols) => {
            // Uncomment to test a portion of symbols
            // symbols = symbols.slice(0, 50);

            // try to get previous results
            let previousResults = await getDocument("results", id);
            if (typeof (previousResults["results"]) == "string") {
                previousResults = undefined;
            }
            // maps symbol to buy/sell data
            let intersections = {};

            // create threads that split up the work
            let finishedWorkers = 0;
            let partitionSize = Math.ceil(symbols.length / NUM_THREADS);
            let progress = 0;
            for (let i = 0; i < NUM_THREADS; ++i) {
                // divy up the symbols for each thread to work on
                let partition = symbols.slice(i * partitionSize, (i + 1) * partitionSize);

                // spawn child to do work
                let child = fork(path.join(__dirname, "worker.js"));
                child.on('message', async (msg) => {
                    if (msg.status == "finished") {
                        // assign partition's results to collective results
                        Object.assign(intersections, msg.intersections);
                        // if all worker threads are finished
                        if (++finishedWorkers == NUM_THREADS) {
                            let results = { strategyOptions, symbolData: intersections, lastUpdated: new Date() };
                            // add result to database
                            await addResult(id, results);
                            resolve();
                        }
                    }
                    if (msg.status == "progress") {
                        progress += msg.progress;
                        triggerChannel(id, "onProgressUpdate", { progress: 100 * progress / symbols.length });
                    }
                })
                child.send({ type: "startIntersection", strategyOptions, id, previousResults, partition });
            }
        });
    })
}

// gets the symbols from cache or from csv
function getSymbols() {
    return new Promise((resolve, reject) => {
        // read from cache
        if (fs.existsSync(PATH_TO_SYMBOLS) && useCache) {
            console.log("Loading Symbols from Cache...");
            let symbols = JSON.parse(fs.readFileSync(PATH_TO_SYMBOLS, { encoding: "utf-8" }));
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
                        if (!stock[0].includes(".") && !stock[0].includes("^"))
                            symbols.push(stock[0].trim());
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

// gets an indicator object
function getIndicator(indicatorName, indicatorOptions, symbol, dates, prices, opens, highs, lows, closes) {
    let indicator = new INDICATOR_OBJECTS[indicatorName](symbol, dates, prices, opens, highs, lows, closes);
    indicator.initialize(indicatorOptions);
    return indicator;
}

// Get price from own database
function getPrices(symbol) {
    return new Promise(async (resolve, reject) => {
        getDocument("prices", symbol)
            .then(document => {
                resolve(document.prices);
            })
            .catch(err => reject(err));
    });
}

// given symbol, find intersections
function findIntersections(strategyOptions, symbol, previousResults, lastUpdated) {
    // let strategyOptions = {
    //     "indicators": {
    //         "SMA": { "period": 9 },
    //         "RSI": { "period": 14, "underbought": 30, "overbought": 70 },
    //         "MACD": { "ema1": 12, "ema2": 26, "signalPeriod": 9 },
    //     },
    //     "mainBuyIndicator": "RSI",
    //     "mainSellIndicator": "RSI",
    //     "minVolume": 1000000,
    //     "expiration": 7,
    //     "multipleBuys": true,
    // };

    return new Promise((resolve, reject) => {
        // find prices
        getPrices(symbol)
            .then(json => {
                // if error
                if (json["error"]) {
                    reject(json["error"]);
                }
                // if valid prices
                else {
                    // maps date to closing price
                    let prices = {};
                    let volumes = {};
                    let opens = {};
                    let highs = {};
                    let lows = {};
                    let closes = {};

                    let cutoffIndex = 0;
                    if (lastUpdated) {
                        // find first index where date is greater than last updated
                        for(let i = json.length - 1; i >= 0; --i) {
                            if (json[i]["date"] < lastUpdated) {
                                cutoffIndex = i;
                                break;
                            }
                        }
                        cutoffIndex = Math.max(0, cutoffIndex - 200);
                    }

                    for(; cutoffIndex < json.length; ++cutoffIndex){
                        let day = json[cutoffIndex];
                        let date = new Date(day["date"]);
                    
                        let formattedDate = date.toISOString();
                        let adjScale = day["adjClose"] / day["close"];
                        prices[formattedDate] = day["adjClose"];
                        volumes[formattedDate] = day["volume"];
                        opens[formattedDate] = day["open"] * adjScale;
                        highs[formattedDate] = day["high"] * adjScale;
                        lows[formattedDate] = day["low"] * adjScale;
                        closes[formattedDate] = day["close"] * adjScale;
                    };

                    // get sorted dates
                    let dates = Object.keys(prices).sort(function (a, b) {
                        return new Date(a) - new Date(b);
                    });

                    let profit = 0;
                    let percentProfit = 0;
                    let count = 0;

                    // create indicator objects
                    let mainBuyIndicator;
                    let mainSellIndicator;
                    let supportingBuyIndicators = [];
                    let supportingSellIndicators = [];
                    let buyMap = {};
                    let sellMap = {};
                    let stopLossIndicator = getIndicator("SMA", { period: 180, minDuration: 3 }, symbol, dates, prices, opens, highs, lows, closes);
                    stopLossIndicator = undefined;

                    // set main/support buy indicators
                    Object.keys(strategyOptions["buyIndicators"]).forEach(indicatorName => {
                        let indicatorOptions = strategyOptions["buyIndicators"][indicatorName];
                        let indicator = getIndicator(indicatorName, indicatorOptions, symbol, dates, prices, opens, highs, lows, closes);

                        // track buy indicators
                        if (indicatorName == strategyOptions["mainBuyIndicator"]) {
                            mainBuyIndicator = indicator;
                        }
                        else {
                            supportingBuyIndicators.push(indicator);
                            buyMap[indicatorName] = false;
                        }
                    })

                    // set main/support sell indicators
                    Object.keys(strategyOptions["sellIndicators"]).forEach(indicatorName => {
                        let indicatorOptions = strategyOptions["sellIndicators"][indicatorName];
                        let indicator = getIndicator(indicatorName, indicatorOptions, symbol, dates, prices, opens, highs, lows, closes);

                        // track sell indicators
                        if (indicatorName == strategyOptions["mainSellIndicator"]) {
                            mainSellIndicator = indicator;
                        }
                        else {
                            supportingSellIndicators.push(indicator);
                            sellMap[indicatorName] = false;
                        }
                    })

                    // store buy/sell information
                    let expiration = strategyOptions["expiration"];
                    let buyPrices = [];
                    let buyDates = [];
                    let buySignal;
                    let sellSignal;
                    let buyExpiration = expiration;
                    let sellExpiration = expiration;

                    // store buy/sell events for debugging
                    let events = [];
                    let event = {};
                    let startIndex = 0;

                    // load data from previous results
                    if (lastUpdated) {
                        // load previous hits
                        if (previousResults) {
                            events = previousResults["events"];

                            // carry over holdings to look for sells
                            previousResults["holdings"].forEach(holding => {
                                buyDates.push(holding);
                                buyPrices.push(prices[holding]);
                            })

                            // carry over profits
                            profit = previousResults["profit"];
                            count = events.length;
                            percentProfit = previousResults["percentProfit"] * count;
                        }

                        // start from the date after the last update
                        for (let i = 0; i < dates.length; ++i) {
                            let day = new Date(dates[i]);
                            if (day > lastUpdated) {
                                startIndex = i;
                                break;
                            }
                        }
                        // if theres no changes since last update
                        if (startIndex == 0) {
                            // end the backtest for this symbol
                            startIndex = dates.length;
                        }
                    }

                    // loops over dates and checks for buy signal
                    for (let i = startIndex; i < dates.length; ++i) {
                        let day = dates[i];
                        // if main buy indicator goes off
                        if (mainBuyIndicator.getAction(day) == Indicator.BUY && volumes[day] > strategyOptions["minVolume"]) {
                            buySignal = true;
                        }
                        if (buySignal) {
                            // check each non main indicator for buy signal
                            supportingBuyIndicators.forEach(indicator => {
                                if (indicator.getAction(day) == Indicator.BUY) {
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

                        // find stoploss trades
                        let stopLossTrades = [];
                        if (strategyOptions["stopLossLow"]) {
                            stopLossTrades = stopLossTrades.concat(buyPrices.filter(bp => bp * strategyOptions["stopLossLow"] > prices[day]))
                        }
                        if (strategyOptions["stopLossHigh"]) {
                            stopLossTrades = stopLossTrades.concat(buyPrices.filter(bp => bp * strategyOptions["stopLossHigh"] < prices[day]))
                        }
                        // if stoploss indicator goes off, sell all
                        if (stopLossIndicator && stopLossIndicator.shouldStop(day) == Indicator.STOP) {
                            stopLossTrades = buyPrices;
                        }

                        // if stoploss triggered or main seller indicator goes off and has stocks to sell
                        if (stopLossTrades.length > 0 || (mainSellIndicator.getAction(day) == Indicator.SELL && buyPrices.length > 0)) {
                            sellSignal = true;
                        }
                        if (sellSignal) {
                            // check each non main indicator for sell signal
                            supportingSellIndicators.forEach(indicator => {
                                if (indicator.getAction(day) == Indicator.SELL) {
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

                            // if all supports agree or stoploss triggered, sell the stock
                            if (allIndicatorsSell || stopLossTriggered) {
                                let newBuyPrices = [];
                                let newBuyDates = [];

                                // sell all stocks that were bought
                                for (let i = 0; i < buyPrices.length; ++i) {
                                    let buyPrice = buyPrices[i];
                                    let buyDate = buyDates[i];

                                    // dont sell if stoploss not met
                                    if (stopLossTrades.length > 0 && !stopLossTrades.includes(buyPrice)) {
                                        newBuyPrices.push(buyPrice);
                                        newBuyDates.push(buyDate);
                                        continue;
                                    }

                                    // populate transaction information
                                    event["buyDate"] = buyDate;
                                    event["sellDate"] = day;
                                    event["profit"] = prices[day] - buyPrice;
                                    event["percentProfit"] = (prices[day] - buyPrice) / buyPrice
                                    event["span"] = daysBetween(new Date(buyDate), new Date(day));

                                    // calculate stats
                                    profit += event["profit"];
                                    percentProfit += event["percentProfit"];
                                    count += 1;

                                    // add and create new event
                                    events.push(event);
                                    event = {};
                                }

                                buyPrices = newBuyPrices;
                                buyDates = newBuyDates;
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

                    resolve({ "profit": profit, "percentProfit": percentProfit / count, "events": events, "holdings": buyDates });
                }
            });
    })
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

module.exports = { conductBacktest, findIntersections, getSymbols, getIndicator };