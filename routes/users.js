var express = require('express');
var router = express.Router();
var yahooFinance = require('yahoo-finance');
var fetch = require('node-fetch');
let { resetSymbol } = require('../helpers/stock');
let { containsID, getDocument, setDocumentField, addDocument } = require('../helpers/mongo');
let { getIndicator, getActionsToday } = require('../helpers/backtest');
let { addToStocksTrackerWatchlist } = require('../helpers/stockstracker');
let { addToFinvizWatchlist } = require('../helpers/finviz');
let { addJob } = require('../helpers/queue');
const bson = require('bson');
const DOC_LIMIT = 16777216;

let watchlistFunctions = {
    "StocksTracker": addToStocksTrackerWatchlist,
    "Finviz": addToFinvizWatchlist
}

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

router.get('/job', async function (req, res) {
    addJob(() => {
        return new Promise(async res => {
            await new Promise(r => setTimeout(r, 5000));
            console.log(req.query);
            res();
        })
    });

    res.send("ok");
})

router.get("/test", async function (req, res) {
    let symbol = req.query.symbol;

    if (!await containsID("results", "test")) {
        await addDocument("results", { _id: "test" });
    }

    let data = [];
    for (i = 0; i < 1000000; ++i) {
        data.push("1234567890");
    }
    try {
        await setDocumentField("results", "test", "data", { subField: data }, { subField: "subField" });
    }
    catch (Exception) {
        console.log(Exception)
    }

    console.log(await getDocument("results", "test"));

    res.send("ok")
});

router.post('/watchlist', async function (req, res) {
    let destination = req.body.destination;
    let symbols = req.body.symbols;
    let login = req.body.login;
    let watchlist = req.body.watchlist;
    let position = addJob(() => {
        return new Promise(async resolveJob => {
            await watchlistFunctions[destination](symbols, login, watchlist);
            resolveJob();
        })
    }, true)
    if (position == 0) {
        res.json({ status: "Adding to your watchlist!" });
    }
    else {
        res.json({ status: `Will add to your watchlist within ${30 * position} minutes!` });
    }
})

router.get('/indicator', async function (req, res) {
    let symbol = req.query["symbol"];
    let indicatorName = "Swing";
    let indicatorOptions = { period: 10, volatility: .10 };

    console.log(symbol, indicatorName, indicatorOptions);

    let stockInfo = await getDocument(symbol);
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