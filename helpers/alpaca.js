const Alpaca = require('@alpacahq/alpaca-trade-api');
const { daysBetween } = require('../client/src/helpers/utils');
const { toPST } = require('./utils')

const BACKTEST_YEARS = 5;

const config = {
    keyId: process.env.APCA_API_KEY_ID,
    secretKey: process.env.APCA_API_SECRET_KEY,
};
let alpaca = new Alpaca(config)

function changeAccount(credentials) {
    alpaca = new Alpaca({
        keyId: credentials["id"],
        secretKey: credentials["key"],
        paper: true
    })
}

function getAccount() {
    return alpaca.getAccount();
}

function getOpenOrders() {
    return alpaca.getOrders({
        status: 'open'
    })
}

function getClosedOrders() {
    return alpaca.getOrders({
        status: 'closed',
        limit: 500   
    })
}

function getPositions() {
    return alpaca.getPositions();
}

function getPosition(symbol) {
    return alpaca.getPosition(symbol);
}

function getAlpacaBars(s, startDate, endDate, timeframe) {
    return new Promise(async (resolve, reject) => {
        let symbols = [s];
        let results = {}; // maps symbol to list of bar data
        let dates = {}; // maps symbol to set of existing dates
        let done = {}; // true if symbol got as far as possible
        let faulty = {}; // true if symbol is faulty

        // max day gaps for each timeframe 
        let maxThresholds = {
            "15Min": 100 // tight restriction for high quality
        }

        // intializes
        symbols.forEach(symbol => {
            results[symbol] = [];
            done[symbol] = false;
            dates[symbol] = new Set();
            faulty[symbol] = false;
        })

        let untilDate = new Date();
        while (!Object.values(done).every(v => v ? true : false)) {
            // empty list for symbols that dont exist
            let bars = {};
            let success = false;
            while (!success) {
                try {
                    console.log("trying bars v2")
                    bars = await alpaca.getBarsV2(
                        s,
                        {
                            timeframe: timeframe,
                            limit: 1000,
                            start: startDate,
                            end: untilDate
                        },
                        alpaca.configuration
                    );
                    success = true;
                }
                catch(e) {
                    console.log(e["message"]);
                    // too many requests
                    if (e["statusCode"] == 429) {
                        console.log("Resting...");
                        await new Promise(r => setTimeout(r, 15000));
                    }
                }
            }

            for await (let value of bars) {
                console.log(value)
            }

            let newestEndDate = new Date("1/1/1500");
            resultingSymbols = Object.keys(bars);
            let entryAdded = false;
            for (let symbolIndex = 0; symbolIndex < resultingSymbols.length; ++symbolIndex) {
                symbol = resultingSymbols[symbolIndex];
                // already done, skip
                if (done[symbol]) {
                    continue;
                }

                let symbolBars = bars[symbol];
                // no more results for symbol
                if (symbolBars.length == 0) {
                    done[symbol] = true;
                }
                // process local results
                else {
                    let first = undefined;
                    let last = undefined;
                    for (let i = symbolBars.length - 1; i >= 0; --i) {
                        let bar = symbolBars[i];
                        let epochTime = bar["startEpochTime"];
                        let date = new Date(epochTime * 1000);
                        // make sure there are no overlaps/repeats
                        if (dates[symbol].has(epochTime)) {
                            continue;
                        }
                        else {
                            if (!last) {
                                last = date;
                                entryAdded = true;
                            }
                            let entry = {
                                date: date,
                                open: bar["openPrice"],
                                high: bar["highPrice"],
                                low: bar["lowPrice"],
                                close: bar["closePrice"],
                                volume: bar["volume"]
                            }
                            results[symbol].unshift(entry);
                            dates[symbol].add(epochTime);
                        }
                    }

                    first = results[symbol][0]["date"];

                    // check for faulty data
                    if (maxThresholds[timeframe] && daysBetween(first, last) > maxThresholds[timeframe]) {
                        console.log("Faulty", symbol, daysBetween(first, last), "over limit of", maxThresholds[timeframe]);
                        faulty[symbol] = true;
                        done[symbol] = true;
                    }

                    // also done if got enough data
                    // if (results[symbol].length >= 8000) {
                    //     done[symbol] = true;
                    // }

                    // keep track of newest end date
                    if (results[symbol][0]["date"] > newestEndDate) {
                        newestEndDate = results[symbol][0]["date"]
                    }

                    // console.log(symbol, results[symbol][0]["date"], last)
                }
            }

            untilDate = newestEndDate;
            // if no more new data
            if (!entryAdded) {
                console.log("No more new data!");
                break;
            }
        }

        // remove symbols that have no data or are faulty
        Object.keys(results).forEach(symbol => {
            if (results[symbol].length == 0 || faulty[symbol]) {
                results[symbol] = [];
            }
            else {
                // print out final ranges
                console.log(symbol, results[symbol][0]["date"], results[symbol][results[symbol].length - 1]["date"])
            }

        })

        // console.log("kept", Object.keys(results).length)

        resolve(results[s]);
    })
}

function cancelPreviousOrders() {
    alpaca.getOrders({
        status: 'open'
    }).then(async orders => {
        let cancelledOrders = 0;
        for (let i = 0; i < orders.length; ++i) {
            let order = orders[i];
            // simply cancel buy
            if (order["side"] == "buy") {
                await alpaca.cancelOrder(order["id"]);
                cancelledOrders += 1;
            }
        }
        console.log(`Cancelled ${cancelledOrders} Alpaca Orders`);
    })
}

function cancelAllOrders() {
    return alpaca.cancelAllOrders();
}

function requestBracketOrder(symbol, buyPrice, positionSize, stoploss, target) {
    return new Promise((resolve, reject) => {
        getAccount().then(account => {
            let totalEquity = parseFloat(account["equity"]);
            let qty = (totalEquity * positionSize) / buyPrice;
            alpaca.createOrder({
                symbol: symbol,
                qty: Math.floor(qty),
                side: 'buy',
                type: 'limit',
                time_in_force: 'gtc',
                limit_price: buyPrice,
                order_class: 'bracket',
                stop_loss: {
                    stop_price: stoploss,
                    // limit_price: stoploss * .999 // trying stop instead of stop-limit
                },
                take_profit: {
                    limit_price: target
                }
            }).then(order => resolve(order))
                .catch(err => reject(err));
        })
    })
}

function requestMarketOrderSell(symbol) {
    return new Promise(async (resolve, reject) => {
        let position = await getPosition(symbol);
        let qty = parseInt(position["qty"]);

        alpaca.createOrder({
            symbol: symbol,
            qty: qty,
            side: 'sell',
            type: 'market',
            time_in_force: 'gtc'
        }).then(order => resolve(order))
            .catch(err => reject(err));
    })
}

module.exports = { changeAccount, getAccount, getOpenOrders, getClosedOrders, getPositions, getAlpacaBars, cancelAllOrders, cancelPreviousOrders, requestBracketOrder, requestMarketOrderSell, };