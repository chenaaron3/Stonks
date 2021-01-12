let fetch = require('node-fetch');
var path = require('path');
var fs = require('fs');
let sizeof = require('object-sizeof')
const { fork } = require('child_process');
const sgMail = require('@sendgrid/mail');

// own helpers
const csv = require('csv');
let { fixFaulty } = require('../helpers/stock');
let { addResult, getDocument, setDocumentField, containsID } = require('../helpers/mongo');
let { daysBetween, sameDay } = require('../helpers/utils');
let { triggerChannel } = require('../helpers/pusher');
let { addJob } = require('../helpers/queue');

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
let ATR = require('../helpers/indicators/atr');
let Pullback = require('../helpers/indicators/pullback');
let Breakout = require('../helpers/indicators/breakout');
let Swing = require('../helpers/indicators/swing');
let Divergence = require('../helpers/indicators/divergence');
let Stochastic = require('../helpers/indicators/stochastic');
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
    "Structure": Structure,
    "ATR": ATR,
    "Pullback": Pullback,
    "Breakout": Breakout,
    "Swing": Swing,
    "Divergence": Divergence,
    "Stochastic": Stochastic
}

// paths to resources
let PATH_TO_SYMBOLS = path.join(__dirname, "../res/symbols.json");
let PATH_TO_FAULTY = path.join(__dirname, "../res/faulty.json");
let PATH_TO_BLACKLIST = path.join(__dirname, "../res/blacklist.json");

// only get symbols from these exchanges
let EXCHANGES = ["amex", "nasdaq", "nyse"];
// how many threads to spawn on each request
const NUM_THREADS = 4;

// cache settings
const useCache = true;

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
            // already updating
            else if (doc["status"] == "updating") {
                resolveJob();
                return;
            }
            else {
                setDocumentField(id, "status", "updating");
            }
            let strategyOptions = doc.results["strategyOptions"];

            // spawn child to do work
            let child = fork(path.join(__dirname, "../helpers/worker.js"));
            child.send({ type: "startBacktest", strategyOptions, id });
            child.on('message', function (message) {
                console.log(message);
                if (message.status == "finished") {
                    setDocumentField(id, "status", "ready");
                    console.log("Trigger client", id);
                    triggerChannel(id, "onUpdateFinished", { id: `${id}` });
                    resolveJob();
                }
            });
        });
    });
}

// get actions today for a backtest
async function getActionsToday(id, email, sessionID) {
    return addJob(() => {
        return new Promise(async resolveJob => {
            let doc = await getDocument("results", id);
            let symbols = Object.keys(doc["results"]["symbolData"]);
            let userDoc = await getDocument("sessions", sessionID);
            let watchlist = Object.keys(JSON.parse(userDoc["session"])["buys"]);
            let today = new Date();
            let actions = { buy: [], sell: [] };

            symbols.forEach(symbol => {
                let symbolData = doc["results"]["symbolData"][symbol];

                // // look through holdings for buy actions  
                // let holdings = symbolData["holdings"];
                // if (holdings.length > 0 && daysBetween(today, new Date(holdings[holdings.length - 1])) < 2) {
                //     actions["buy"].push(symbol);
                // }

                // look through events for sell actions
                let events = symbolData["events"];
                if (watchlist.includes(symbol) && events.length > 0 && daysBetween(today, new Date(events[events.length - 1]["sellDate"])) < 2) {
                    actions["sell"].push(symbol);
                }
            });

            // only send email if there are stocks to sell
            if (actions["sell"].length > 0) {
                let text = "Symbols to Sell:\n" + actions["sell"].join("\n");

                // send email
                sgMail.setApiKey(process.env.SENDGRID_API_KEY);
                const msg = {
                    to: email,
                    from: "backtest@updated.com",
                    subject: "You Have Stocks To Sell!",
                    text: text
                };
                sgMail.send(msg)
                    .then(() => console.log("Email sent to ", email))
                    .catch(function (err) {
                        console.log(err);
                        console.log(err["response"]["body"]["errors"])
                    })
            }
            resolveJob();
        })
    });
}

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

                            let results = { strategyOptions, symbolData: intersections, lastUpdated: new Date() };
                            // add result to database
                            let err = await addResult(id, results);
                            // todo deal with oversized results by trimming
                            if (err) {
                                console.log(sizeof(results));
                            }
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
            symbols = symbols.filter(s => !blacklist.includes(s));
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
                        if (!symbol.includes(".") && !symbol.includes("^") && !blacklist.includes(symbol))
                            symbols.push(symbol.trim());
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
                    // maps date to data
                    let [prices, volumes, opens, highs, lows, closes, dates] = getAdjustedData(json, lastUpdated);

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
                                buyDates.push(holding);
                                buyPrices.push(prices[holding]);
                            })

                            // carry over profits
                            profit = previousResults["profit"];
                            percentProfit = previousResults["percentProfit"] * events.length;
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
                                earlyTrades[bd] = prices[bd];
                            })
                        }

                        // if stoploss triggered or main seller indicator goes off and has stocks to sell
                        if (Object.keys(earlyTrades).length > 0 || (mainSellIndicator.getAction(day, i, true) == Indicator.SELL && buyPrices.length > 0)) {
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
                            if (allIndicatorsSell || Object.keys(earlyTrades).length > 0) {
                                let newBuyPrices = [];
                                let newBuyDates = [];
                                let newStoplossTarget = {};

                                // sell all stocks that were bought
                                for (let i = 0; i < buyPrices.length; ++i) {
                                    let buyPrice = buyPrices[i];
                                    let buyDate = buyDates[i];
                                    let sellPrice = prices[day];

                                    // if early trades exist
                                    if (Object.keys(earlyTrades).length > 0) {
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
                                                sellPrice = earlyTrades[buyDate];
                                            }
                                        }
                                    }

                                    // populate transaction information
                                    event["buyDate"] = buyDate;
                                    event["sellDate"] = day;
                                    event["profit"] = sellPrice - buyPrice;
                                    event["percentProfit"] = (sellPrice - buyPrice) / buyPrice
                                    event["span"] = daysBetween(new Date(buyDate), new Date(day));
                                    if (stoplossTarget.hasOwnProperty(buyDate)) {
                                        let stoploss = stoplossTarget[buyDate]["stoploss"];
                                        event["risk"] = (buyPrice - stoploss) / buyPrice * 100;
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

                    // if too many results, truncate old ones
                    if (events.length > 500) {
                        events = events.slice(events.length - 500, events.length);
                        // recalculate profit
                        profit = 0;
                        percentProfit = 0;
                        for (let i = 0; i < events.length; ++i) {
                            profit += events[i]["profit"];
                            percentProfit += events[i]["percentProfit"];
                        }
                    }

                    resolve({ "profit": profit, "percentProfit": percentProfit / events.length, "events": events, "holdings": buyDates, "faulty": faulty });
                }
            });
    })
}

// convert raw data from api to adjusted prices for backtest
function getAdjustedData(rawData, lastUpdated) {
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
        cutoffIndex = Math.max(0, cutoffIndex - 200);
    }

    // parse list into dictionaries
    for (; cutoffIndex < rawData.length; ++cutoffIndex) {
        let day = rawData[cutoffIndex];
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

// calculate stoplosses and targets
function setStoplossTarget(stoplossTarget, strategyOptions, buyPrice, buyDate, atr, lows, highs, dates, dateIndex) {
    let stoploss = undefined;
    let target = undefined;

    // find static stoploss trades (deprecated in front-end)
    if (strategyOptions["stopLossLow"]) {
        stoploss = buyPrice * strategyOptions["stopLossLow"];
    }
    if (strategyOptions["stopLossHigh"]) {
        target = buyPrice * strategyOptions["stopLossHigh"];
    }

    if (strategyOptions["targetAtr"]) {
        let multiplier = strategyOptions["targetAtr"];
        target = buyPrice + multiplier * atr.getValue(buyDate);
    }

    // use ATR for stoploss
    if (strategyOptions["stopLossAtr"]) {
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
    if (stoploss && strategyOptions["riskRewardRatio"]) {
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
        stoplossTarget[buyDate] = {};
        stoplossTarget[buyDate]["stoploss"] = stoploss;
        stoplossTarget[buyDate]["target"] = target;
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
        if (bd == day) return;
        let stoploss = stoplossTarget[bd]["stoploss"];
        let target = stoplossTarget[bd]["target"];
        if (stoploss && low < stoploss) {
            earlyTrades[bd] = stoploss;
        }
        if (target && high > target) {
            earlyTrades[bd] = target;
        }
    });

    // overdue stocks
    if (strategyOptions["maxDays"]) {
        Object.keys(stoplossTarget).forEach((bd) => {
            if (daysBetween(new Date(bd), new Date(day)) > strategyOptions["maxDays"]) {
                earlyTrades[bd] = price;
            }
        });
    }

    return earlyTrades;
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

module.exports = { backtest, updateBacktest, getActionsToday, conductBacktest, findIntersections, getSymbols, getAdjustedData, getIndicator };