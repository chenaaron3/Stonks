import Alpaca, { BarsV2Response, GetHistoricalOptions, Timeframe, TradeDirection, TradeType, TimeInForce, AlpacaOrder } from '@alpacahq/alpaca-trade-api';
import axios from 'axios';

import { AlpacaCredentialsData } from '../types/types';
import { BarData } from '@shared/common';

const config = {
    keyId: process.env.APCA_API_KEY_ID,
    secretKey: process.env.APCA_API_SECRET_KEY,
};
let alpaca = new Alpaca(config)

function changeAccount(credentials: AlpacaCredentialsData) {
    alpaca = new Alpaca({
        keyId: credentials.id,
        secretKey: credentials.key,
        paper: credentials.paper || true
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

function getPosition(symbol: string) {
    return alpaca.getPosition(symbol);
}

function formatDate(date: string | Date) {
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

function getBarsV2(symbol: string, params: GetHistoricalOptions): Promise<BarsV2Response> {
    const url = `https://data.alpaca.markets/v2/stocks/${symbol}/bars`
    const options = {
        headers: {
            'APCA-API-KEY-ID': alpaca.configuration.keyId,
            'APCA-API-SECRET-KEY': alpaca.configuration.secretKey
        },
        params: params
    }

    return new Promise(async (resolve, reject) => {
        await axios.get<BarsV2Response>(url, options)
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

function getAlpacaBars(s: string, startDate: Date, endDate: Date, timeframe: Timeframe): Promise<BarData[]> {
    return new Promise(async (resolve, reject) => {
        let results: BarData[] = [];
        let finished = false;
        let pageToken = undefined;

        while (!finished) {
            // empty list for symbols that dont exist
            let bars: BarsV2Response = null!;
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
                        }
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

            let transformed: BarData[] = [];
            if (bars && bars['bars']) {
                transformed = bars['bars'].map(raw => {
                    return {
                        date: (new Date(raw["t"])),
                        open: raw["o"],
                        high: raw["h"],
                        low: raw["l"],
                        close: raw["c"],
                        volume: raw["v"]
                    }
                });
            }

            // append section to overall results
            results.push.apply(results, transformed);

            // if more pages to process
            if (bars['next_page_token']) {
                pageToken = bars['next_page_token'];
            }
            // no more pages
            else {
                finished = true;
            }
        }

        // console.log(results[0], results[results.length - 1])

        resolve(results);
    })
}

function cancelPreviousOrders() {
    return new Promise<void>(resolve => {
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
            resolve();
        })
    })
}

function cancelAllOrders() {
    return alpaca.cancelAllOrders();
}

function requestBracketOrder(symbol: string, buyPrice: number, positionSize: number, stoploss: number, target: number) {
    return new Promise<AlpacaOrder>((resolve, reject) => {
        getAccount().then(account => {
            let totalEquity = parseFloat(account["equity"]);
            let qty = (totalEquity * positionSize) / buyPrice;
            alpaca.createOrder({
                symbol: symbol,
                qty: Math.floor(qty),
                side: TradeDirection.buy,
                type: TradeType.limit,
                time_in_force: TimeInForce.gtc,
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

function requestMarketOrderSell(symbol: string) {
    return new Promise(async (resolve, reject) => {
        let position = await getPosition(symbol);
        let qty = parseInt(position["qty"]);

        alpaca.createOrder({
            symbol: symbol,
            qty: qty,
            side: TradeDirection.sell,
            type: TradeType.market,
            time_in_force: TimeInForce.gtc
        }).then(order => resolve(order))
            .catch(err => reject(err));
    })
}

export { changeAccount, getAccount, getOpenOrders, getClosedOrders, getPositions, getAlpacaBars, cancelAllOrders, cancelPreviousOrders, requestBracketOrder, requestMarketOrderSell, };