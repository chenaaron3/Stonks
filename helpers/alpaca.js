const Alpaca = require('@alpacahq/alpaca-trade-api')
const { toPST } = require('./utils')

const BACKTEST_YEARS = 5;

let alpaca = new Alpaca({
    keyId: process.env.APCA_API_KEY_ID,
    secretKey: process.env.APCA_API_SECRET_KEY
})

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

function getAlpacaBars(symbols, startDate, endDate, timeframe) {
    return new Promise(async (resolve, reject) => {
        let lastDate = {}; // maps symbol to oldest date
        let results = {}; // maps symbol to list of bar data
        let dates = {}; // maps symbol to set of existing dates
        let done = {}; // true if symbol got as far as possible

        // intializes
        symbols.forEach(symbol => {
            results[symbol] = [];
            done[symbol] = false;
            dates[symbol] = new Set();
        })

        let lastUntilDate = undefined;
        let untilDate = new Date();
        while (!Object.values(done).every(v => v ? true : false)) {
            // empty list for symbols that dont exist
            let bars = await alpaca.getBars(
                timeframe, symbols,
                {
                    limit: 1000,
                    end: lastUntilDate,
                }
            )

            let newestEndDate = new Date("1/1/1500");
            resultingSymbols = Object.keys(bars);
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
                    for (let i = symbolBars.length - 1; i >= 0; --i) {
                        let bar = symbolBars[i];
                        let epochTime = bar["startEpochTime"];
                        let date = new Date(epochTime * 1000);
                        if (date.toISOString() == "2020-04-09T11:15:00.000Z") {
                            console.log("")
                        }
                        // overlap, do not add
                        if (dates[symbol].has(epochTime)) {
                            continue;
                        }
                        else {
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

                    // check dupes within local
                    let duplicates = new Set();
                    results[symbol].forEach(entry => {
                        if (duplicates.has(entry["date"].getTime())) {
                            console.log(symbol, "DUPE", entry["date"]);
                        }
                        duplicates.add(entry["date"].getTime());
                    })

                    // also done if got enough data
                    if (results[symbol].length >= 8000) {
                        done[symbol] = true;
                    }

                    console.log(symbol, results[symbol][0]["date"])
                    // keep track of newest date
                    if (results[symbol][0]["date"] > newestEndDate) {
                        newestEndDate = results[symbol][0]["date"]
                    }
                }
            }

            console.log("until", untilDate)
            // newestEndDate.setDate(newestEndDate.getDate() + 1);
            untilDate = newestEndDate;
            // if no more new data
            if (lastUntilDate == untilDate) {
                console.log("No more new data!");
                break;
            }
            // keep going back
            else {
                lastUntilDate = untilDate;
            }
        }

        // remove symbols that have no data
        Object.keys(results).forEach(symbol => {
            if (results[symbol].length == 0) {
                delete results[symbol];
            }
            else {
                // check duplicate dates
                let dates = new Set();
                results[symbol].forEach(entry => {
                    if (dates.has(entry["date"].getTime())) {
                        console.log(symbol, entry["date"]);
                    }
                    dates.add(entry["date"].getTime());
                })
            }

        })

        resolve(results);
    })
}

function cancelAllBuyOrders() {
    alpaca.getOrders({
        status: 'open'
    }).then(async orders => {
        let cancelledOrders = 0;
        for (let i = 0; i < orders.length; ++i) {
            let order = orders[i];
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
            let totalEquity = parseFloat(account["buying_power"]) + parseFloat(account["equity"]);
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
                    limit_price: stoploss * .999
                },
                take_profit: {
                    limit_price: target
                }
            }).then(order => resolve(order))
                .catch(err => reject(err));
        })
    })
}

module.exports = { changeAccount, getAccount, getOpenOrders, cancelAllOrders, cancelAllBuyOrders, requestBracketOrder, getAlpacaBars };