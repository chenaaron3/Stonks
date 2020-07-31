let fetch = require('node-fetch');
var path = require('path');
var fs = require('fs');

// own helpers
var vendor = require('../helpers/vendor');
const csv = require('csv');
let { getStockInfo, addStockInfo, addResult } = require('../helpers/mongo');
let { formatDate, daysBetween } = require('../helpers/utils');

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
let PATH_TO_CSV = path.join(__dirname, "../res/supported_tickers.csv");
let PATH_TO_KEY_CACHE = path.join(__dirname, "../res/symbolToKey.json");

// base api url
const BASE_URL = "https://api.tiingo.com/tiingo/daily";
let EXCHANGES = ["AMEX", "NASDAQ", "NYSE"];
// get recent results within expiration date
let EXPIRATION = 14;
// get prices from today - START_DATE
let START_DATE = 365 * 100;

// cache settings
const useCache = true;
let keyCache = {};
initKeyCache();

// intialize key cache
function initKeyCache() {
    // if key cache doesnt exist
    if (!fs.existsSync(PATH_TO_KEY_CACHE)) {
        // create an empty cache
        console.log("Creating Key Cache...");
        fs.writeFileSync(PATH_TO_KEY_CACHE, "{}");
    }
    if (Object.keys(keyCache).length == 0) {
        // load key cache
        console.log("Loading Key Cache...");
        keyCache = JSON.parse(fs.readFileSync(PATH_TO_KEY_CACHE, { encoding: "utf-8" }));
        console.log("Key Cache loaded!");
    }
}

// conduct a backtest with given strategy
function conductBacktest(strategyOptions, id) {
    return new Promise(resolve => {
        // get list of symbols to query
        getSymbols(async (symbols) => {
            // maps symbol to list of intersecting dates
            let intersections = {};

            // go through each symbol
            for (i = 0; i < 50; ++i) {
                console.log(`\nStock ${i + 1} of ${symbols.length}`);
                let symbol = symbols[i];
                let attempts = 0;
                let fail = false;

                // keep trying until valid key
                while (true) {
                    try {
                        let intersection = await findIntersections(strategyOptions, symbol, i, attempts);
                        // only record if if has intersection
                        if (intersection["events"].length > 0) {
                            intersections[symbol] = intersection;
                        }
                        console.log(`${symbol} => ${intersection["events"].length}`);
                        break;
                    } catch (e) {
                        // if something went wrong, keep trying with new key
                        attempts++;
                        console.log(e);
                        if (e.includes("not found")) {
                            console.log("TICKER ERROR!");
                            fail = true;
                            break;
                        }
                        // if all keys fail
                        if (attempts >= vendor.numKeys()) {
                            console.log("MAX KEY FAILURE!");
                            fail = true;
                            break;
                        }
                    }
                }
                if (fail) continue;
            }

            // add result to database
            addResult(id, intersections);

            // store back keyCache
            console.log("\nUpdating Key Cache...");
            fs.writeFileSync(PATH_TO_KEY_CACHE, JSON.stringify(keyCache), { encoding: "utf-8" })
            console.log("Key Cache Size: ", Object.keys(keyCache).length);

            resolve();
        });
    })
}

// gets the symbols from cache or from csv
function getSymbols(callback) {
    // read from cache
    if (fs.existsSync(PATH_TO_SYMBOLS) && useCache) {
        console.log("Loading Symbols from Cache...");
        let symbols = JSON.parse(fs.readFileSync(PATH_TO_SYMBOLS, { encoding: "utf-8" }));
        callback(symbols);
    }
    // parse info from csv
    else {
        console.log("Loading Symbols from CSV...");
        // read csv
        let data = fs.readFileSync(PATH_TO_CSV, { encoding: "utf-8" });
        let symbols = [];

        // parse data
        csv.parse(data, {
            comment: '#'
        }, function (err, output) {
            let today = new Date(Date.now());
            // ticker, exchange, assetType, priceCurrency, startDate, endDate
            let labels = output.shift();

            // filter out unwanted stocks
            output.forEach(stock => {
                let d = new Date(stock[5]);
                // US exchanges only, stock only, updated within this year
                if (EXCHANGES.includes(stock[1]) && stock[2] == "Stock" && stock[3] == "USD" && stock[5] && d.getFullYear() == today.getFullYear()) {
                    symbols.push(stock[0]);
                }
            })

            // cache for next use
            console.log("Caching Symbols!");
            fs.writeFile(PATH_TO_SYMBOLS, JSON.stringify(symbols), "utf8", (err) => { if (err) throw err; });
            callback(symbols);
        })
    }
}

// get symbols from results
function getConfirmedSymbols(callback) {
    // update existing results
    console.log("Loading Symbols from Old Results...");
    let symbols = JSON.parse(fs.readFileSync(PATH_TO_OLD_RESULTS, { encoding: "utf-8" }));
    callback(Object.keys(symbols));
}

// given symbol, find intersections
// index and attempts used to find appropriate key
function findIntersections(strategyOptions, symbol, index, attempts) {
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
    let key;
    if (keyCache[symbol] && attempts == 0 && useCache) {
        key = keyCache[symbol];
    }
    else {
        key = vendor.getKey(index, attempts);
    }

    return new Promise((resolve, reject) => {
        // find prices
        getPrices(symbol, key, (json) => {
            // if error
            if (json["error"]) {
                reject(json["error"]);
            }
            // if valid prices
            else {
                // save working key
                keyCache[symbol] = key;

                // maps date to closing price
                let prices = {};
                let volumes = {};
                json.forEach(day => {
                    prices[day["date"]] = day["adjClose"];
                    volumes[day["date"]] = day["adjVolume"];
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
                Object.keys(strategyOptions["indicators"]).forEach(indicatorName => {
                    // check if indicator given is valid
                    if (!INDICATOR_OBJECTS.hasOwnProperty(indicatorName)) {
                        reject(`Invalid Indicator!\nGiven: ${indicatorname}, Expected one of: ${JSON.stringify(Object.keys(INDICATOR_OBJECTS))}`);
                        validIndicators = false;
                        return;
                    }

                    let indicatorOptions = strategyOptions["indicators"][indicatorName];
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

                    // track sell indicators
                    if (indicatorName == strategyOptions["mainSellIndicator"]) {
                        mainSellIndicator = indicator;
                    }
                    else {
                        supportingSellIndicators.push(indicator);
                        sellMap[indicatorName] = false;
                    }
                });

                // eror checking
                if (!validIndicators) {
                    return;
                }
                if (!mainBuyIndicator) {
                    reject(`Missing Buy Indicator!\nGiven: ${strategyOptions["mainBuyIndicator"]}, Expected one of: ${JSON.stringify(Object.keys(strategyOptions["indicators"]))}`);
                    return;
                }
                else if (!mainSellIndicator) {
                    reject(`Missing Sell Indicator!\nGiven: ${strategyOptions["mainSellIndicator"]}, Expected one of: ${JSON.stringify(Object.keys(strategyOptions["indicators"]))}`);
                    return;
                }

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

                    // if stoploss triggered or  main seller indicator goes off and has stocks to sell
                    let stopLossTriggered = lastBuyPrice && strategyOptions["stopLoss"] && lastBuyPrice * strategyOptions["stopLoss"] > prices[day];
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
                        if (stopLossTriggered) {
                            allIndicatorsSell = true;
                        }

                        // if all supports agree, sell the stock
                        if (allIndicatorsSell) {
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

                let recent = {};
                let today = new Date();
                // find recent buy events
                for (let i = 0; i < buyDates.length; ++i) {
                    let buyPrice = buyPrices[i];
                    let buyDate = buyDates[i];
                    let sellDate = dates[dates.length - 1];

                    // store buy/sell conditions for contextual data
                    let buyConditions = getConditions(mainBuyIndicator, supportingBuyIndicators, buyDate);
                    let sellConditions = getConditions(mainSellIndicator, supportingSellIndicators, sellDate);

                    // populate transaction information
                    count += 1;
                    event["buyDate"] = buyDate;
                    event["buyPrice"] = buyPrice;
                    event["buyConditions"] = buyConditions;
                    event["sellDate"] = sellDate;
                    event["sellPrice"] = prices[sellDate];
                    event["sellConditions"] = sellConditions;
                    event["profit"] = prices[sellDate] - buyPrice;
                    profit += event["profit"];
                    event["percentProfit"] = (prices[sellDate] - buyPrice) / buyPrice
                    percentProfit += event["percentProfit"];
                    event["span"] = daysBetween(new Date(buyDate), new Date(sellDate));
                    // add and create new event
                    events.push(event);
                    event = {};

                    if (daysBetween(new Date(buyDate), today) < EXPIRATION) {
                        recent[buyDate] = getConditions(mainBuyIndicator, supportingBuyIndicators, buyDate);
                    }
                }
                resolve({ "profit": profit, "percentProfit": percentProfit / count, "events": events, "recent": recent });
            }
        });
    })
}

// makes api call to get historic prices
async function getPrices(symbol, key, callback) {
    // try using cache
    if (useCache) {
        let stockInfo = await getStockInfo(symbol);
        stockInfo = await stockInfo.toArray();
        // cache hit
        if (stockInfo.length != 0) {
            callback(stockInfo[0]["prices"]);
            return;
        }
    }

    // get start date
    let startDate = new Date();
    startDate.setDate(startDate.getDate() - START_DATE);

    // fetch price data from API
    fetch(BASE_URL + `/${symbol}/prices?startDate=${formatDate(startDate)}`, {
        method: 'get',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Token ${key}`
        },
    })
        .then(res => res.text())
        .then(async text => {
            // parse text to catch errors
            try {
                res = JSON.parse(text)
                // if failed
                if (res["detail"]) {
                    res["error"] = res["detail"];
                }
                else {
                    let msg = await addStockInfo(symbol, res);
                    console.log(msg);
                }
                callback(res);
            }
            // parsing error
            catch (e) {
                callback({ "error": text })
            }
        })
        // API error
        .catch(err => { callback({ "error": err }) });
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

module.exports = { conductBacktest };