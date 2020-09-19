var express = require('express');
var router = express.Router();
var yahooFinance = require('yahoo-finance');
var fetch = require('node-fetch');
let { getStockInfo, containsID, addID, getDocument, setDocumentField } = require('../helpers/mongo');
let { getIndicator } = require('../helpers/backtest');
let { addToWatchlist } = require('../helpers/stockstracker');

/* GET users listing. */
router.get('/', async function (req, res, next) {
    console.log(req.session);

    let symbol = req.query.symbol;
    let from = new Date("1/1/1900")
    yahooFinance.historical({
        symbol: symbol,
        from: from,
        to: new Date(),
        period: 'd'  // 'd' (daily), 'w' (weekly), 'm' (monthly), 'v' (dividends only)
    }, function (err, quotes) {
        res.json(quotes);
        if (err) console.log(err);
    });
});

router.post('/watchlist', async function (req, res) {
    let symbols = req.body.symbols;
    try {
        addToWatchlist(symbols);
        res.send("ok");
    }
    catch {
        res.send("failed");
    }
})

router.get('/indicator', async function (req, res) {
    let symbol = req.query["symbol"];
    let indicatorName = "Structure";
    let indicatorOptions = { period: 26, volatility: .10 };

    console.log(symbol, indicatorName, indicatorOptions);

    let stockInfo = await getStockInfo(symbol);
    stockInfo = await stockInfo.toArray();
    if (stockInfo.length != 0) {
        let pricesJSON = stockInfo[0]["prices"];
        let prices = {};
        let opens = {};
        let highs = {};
        let lows = {};
        let closes = {};
        pricesJSON.forEach(day => {
            let adjScale = day["adjClose"] / day["close"];
            let formattedDate = new Date(day["date"]).toISOString();
            prices[formattedDate] = day["adjClose"];
            opens[formattedDate] = day["open"] * adjScale;
            highs[formattedDate] = day["high"] * adjScale;
            lows[formattedDate] = day["low"] * adjScale;
            closes[formattedDate] = day["close"] * adjScale;
        });
        // get sorted dates
        let dates = Object.keys(prices).sort(function (a, b) {
            return new Date(a) - new Date(b);
        });

        let indicator = getIndicator(indicatorName, indicatorOptions, symbol, dates, prices, opens, highs, lows, closes);

        res.json(indicator.graph);
    }
})

module.exports = router;