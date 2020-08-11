let fetch = require('node-fetch');
var path = require('path');
var fs = require('fs');
const { fork } = require('child_process');

// own helpers
const csv = require('csv');
let { addResult } = require('../helpers/mongo');
let { daysBetween, formatDate } = require('../helpers/utils');
let { getPrices } = require('../helpers/stock');

// indicators
let SMA = require('../helpers/indicators/sma');
let SMASupport = require('../helpers/indicators/smaSupport');
let RSI = require('../helpers/indicators/rsi');
let MACD = require('../helpers/indicators/macd');
let GC = require('../helpers/indicators/gc');
let Indicator = require('../helpers/indicators/indicator');
let INDICATOR_OBJECTS = {
    "SMA": SMA,
    "SMASupport": SMASupport,
    "RSI": RSI,
    "MACD": MACD,
    "GC": GC,
}

// paths to resources
let PATH_TO_OLD_RESULTS = path.join(__dirname, '../res/results.json');
let PATH_TO_SYMBOLS = path.join(__dirname, "../res/symbols.json");

// only get symbols from these exchanges
let EXCHANGES = ["amex", "nasdaq", "nyse"];
// get recent results within expiration date
let EXPIRATION = 14;
// get prices from today - START_DATE
let START_DATE = 365 * 100;
// how many threads to spawn on each request
const NUM_THREADS = 5;

// cache settings
const useCache = false;

// updates a backtest
function updateBacktest(previousResults) {

}

// conduct a backtest with given strategy
function conductBacktest(strategyOptions, id) {
    return new Promise(resolve => {
        // get list of symbols to query
        getSymbols().then(async (symbols) => {
            // Uncomment to test a portion of symbols
            symbols = symbols.slice(0, 50);

            // maps symbol to buy/sell data
            let intersections = {};

            // create threads that split up the work
            let finishedWorkers = 0;
            let partitionSize = Math.ceil(symbols.length / NUM_THREADS);
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
                            // calculate overall information
                            let allSymbols = Object.keys(intersections);
                            let netProfit = 0;
                            let netPercentProfit = 0;
                            allSymbols.forEach(symbol => {
                                netProfit += intersections[symbol]["profit"];
                                netPercentProfit += intersections[symbol]["percentProfit"];
                            })
                            let results = { strategyOptions, netProfit, netPercentProfit: netPercentProfit / allSymbols.length, symbolData: intersections, lastUpdated: new Date() };

                            // add result to database
                            await addResult(id, results);
                            resolve();
                        }
                    }
                })
                child.send({ type: "startIntersection", strategyOptions, id, partition });
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

// get symbols from results
function getConfirmedSymbols(callback) {
    // update existing results
    console.log("Loading Symbols from Old Results...");
    let symbols = JSON.parse(fs.readFileSync(PATH_TO_OLD_RESULTS, { encoding: "utf-8" }));
    callback(Object.keys(symbols));
}

// gets an indicator object
function getIndicator(indicatorName, indicatorOptions, symbol, dates, prices) {
    let indicator = new INDICATOR_OBJECTS[indicatorName](symbol, dates, prices);
    indicator.initialize(indicatorOptions);
    return indicator;
}

// given symbol, find intersections
function findIntersections(strategyOptions, symbol) {
    //  "GC":{"ma1Period":15, "ma2Period":50, "mainBuyIndicator":true}
    // "SMA":{"period":9},
    // "SMASupport":{"period":180},

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
    // get a suitable key

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
                    json.forEach(day => {
                        let formattedDate = new Date(day["date"]).toISOString();
                        prices[formattedDate] = day["adjClose"];
                        volumes[formattedDate] = day["volume"];
                    });

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
                    let validIndicators = true;

                    // set main/support buy indicators
                    Object.keys(strategyOptions["buyIndicators"]).forEach(indicatorName => {
                        let indicatorOptions = strategyOptions["buyIndicators"][indicatorName];
                        let indicator = new INDICATOR_OBJECTS[indicatorName](symbol, dates, prices);
                        // initialize the indicator
                        indicator.initialize(indicatorOptions);

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
                        let indicator = new INDICATOR_OBJECTS[indicatorName](symbol, dates, prices);
                        // initialize the indicator
                        indicator.initialize(indicatorOptions);

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
                    let lastBuyPrice;
                    let buyPrices = [];
                    let buyDates = [];
                    let buySignal;
                    let sellSignal;
                    let buyExpiration = expiration;
                    let sellExpiration = expiration;

                    // store buy/sell events for debugging
                    let events = [];
                    let event = {};
                    let recent = { buy: [], sell: [] };
                    let today = new Date();

                    // loops over dates and checks for buy signal
                    dates.forEach(day => {
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
                                lastBuyPrice = prices[day];
                                buyPrices.push(prices[day]);
                                buyDates.push(day);
                                buySignal = false;
                                buyExpiration = expiration;
                                Object.keys(buyMap).forEach(indicator => {
                                    buyMap[indicator] = false;
                                });

                                // check if is recent buy
                                if (daysBetween(new Date(day), today) < EXPIRATION) {
                                    recent["buy"].push(day);
                                }
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

                        // trigger stoploss if price goes below stoploss threshold
                        let stopLossTriggered = lastBuyPrice && strategyOptions["stopLoss"] && lastBuyPrice * strategyOptions["stopLoss"] > prices[day];
                        // if stoploss triggered or main seller indicator goes off and has stocks to sell
                        if (stopLossTriggered || (mainSellIndicator.getAction(day) == Indicator.SELL && buyPrices.length > 0)) {
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
                            // Object.keys(sellMap).forEach(indicator => {
                            //     if (!sellMap[indicator]) {
                            //         allIndicatorsSell = false;
                            //     }
                            // });

                            // if all supports agree or stoploss triggered, sell the stock
                            if (allIndicatorsSell || stopLossTriggered) {
                                // check if is recent sell
                                if (daysBetween(new Date(day), today) < EXPIRATION) {
                                    recent["sell"].push(day);
                                }

                                // sell all stocks that were bought
                                for (let i = 0; i < buyPrices.length; ++i) {
                                    let buyPrice = buyPrices[i];
                                    let buyDate = buyDates[i];

                                    // store buy/sell conditions for contextual data
                                    let buyConditions = getConditions(mainBuyIndicator, supportingBuyIndicators, buyDate);
                                    let sellConditions = getConditions(mainSellIndicator, supportingSellIndicators, day);

                                    // populate transaction information
                                    count += 1;
                                    event["buyDate"] = buyDate;
                                    event["buyPrice"] = buyPrice;
                                    event["buyConditions"] = buyConditions;
                                    event["sellDate"] = day;
                                    event["sellPrice"] = prices[day];
                                    event["sellConditions"] = sellConditions;
                                    event["profit"] = prices[day] - buyPrice;
                                    profit += event["profit"];
                                    event["percentProfit"] = (prices[day] - buyPrice) / buyPrice
                                    percentProfit += event["percentProfit"];
                                    event["span"] = daysBetween(new Date(buyDate), new Date(day));

                                    // add and create new event
                                    events.push(event);
                                    event = {};
                                }

                                lastBuyPrice = undefined;
                                buyPrices = []
                                buyDates = []
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
                    });

                    resolve({ "profit": profit, "percentProfit": percentProfit / count, "events": events, "recent": recent, "holdings": buyDates });
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