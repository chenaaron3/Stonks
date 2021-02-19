const Alpaca = require('@alpacahq/alpaca-trade-api')

const alpaca = new Alpaca({
    keyId: process.env.APCA_API_KEY_ID,
    secretKey: process.env.APCA_API_SECRET_KEY,
    paper: true,
    usePolygon: false
})

function getAccount() {
    return alpaca.getAccount();
}

function getOpenOrders() {
    return alpaca.getOrders({
        status: 'open'
    })
}

function cancelAllBuyOrders() {
    alpaca.getOrders({
        status: 'open'
    }).then(async orders => {
        let cancelledOrders = 0;
        for(let i = 0; i < orders.length; ++i) {
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

module.exports = { getAccount, getOpenOrders, cancelAllOrders, cancelAllBuyOrders, requestBracketOrder };