const Alpaca = require('@alpacahq/alpaca-trade-api');
const { daysBetween } = require('../client/src/helpers/utils');
const { toPST } = require('./utils');
const axios = require('axios');

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

function formatDate(date) {
    var d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2)
        month = '0' + month;
    if (day.length < 2)
        day = '0' + day;

    return [year, month, day].join('-');
}

function getBarsV2(symbol, params) {
    const url = `https://data.alpaca.markets/v2/stocks/${symbol}/bars`
    const options = {
        headers: {
            'APCA-API-KEY-ID': alpaca.configuration.keyId,
            'APCA-API-SECRET-KEY': alpaca.configuration.secretKey
        },
        params: params
    }

    return new Promise(async (resolve, reject) => {
        await axios.get(url, options)
            .then((response) => {
                // Map response to my data format
                const result = response.data
                resolve(result);
            })
            .catch((err) => {
                console.log("err: ", err.response.data);
                reject(err);
            });
    })
}

function getAlpacaBars(s, startDate, endDate, timeframe) {
    return new Promise(async (resolve, reject) => {
        let results = [];
        let finished = false;
        let pageToken = undefined;

        while (!finished) {
            // empty list for symbols that dont exist
            let bars = [];
            let success = false;
            while (!success) {
                try {
                    bars = await getBarsV2(
                        s,
                        {
                            limit: 10000,
                            start: formatDate(startDate),
                            end: formatDate(endDate),
                            timeframe: timeframe,
                            page_token: pageToken
                        },
                        alpaca.configuration
                    );

                    success = true;
                }
                catch (e) {
                    // end is too late for subscription
                    console.log(e.response.status)
                    if (e.response.status == 422) {
                        endDate.setDate(endDate.getDate() - 1);
                    }
                    else if (e.response.status == 429) {
                        await new Promise(r => setTimeout(r, 30000));
                    }
                }
            }

            let transformed = bars['bars'].map(raw => {
                return {
                    date: (new Date(raw["t"])),
                    open: raw["o"],
                    high: raw["h"],
                    low: raw["l"],
                    close: raw["c"],
                    volume: raw["v"]
                }
            });

            results.push.apply(results, transformed);

            if (bars['next_page_token']) {
                pageToken = bars['next_page_token'];
            }
            else {
                finished = true;
            }
        }

        // console.log(results[0], results[results.length - 1])

        resolve(results);
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