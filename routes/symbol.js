var express = require('express');
var router = express.Router();

let { containsID, addDocument, getDocument, addActiveResult, deleteActiveResult, deleteDocument, getDocumentField, setDocumentField } = require('../helpers/mongo');
let { makeid, daysBetween, getBacktestSummary } = require('../helpers/utils');
let { triggerChannel } = require('../helpers/pusher');
let { backtest, optimizeStoplossTarget, optimizeIndicators, updateBacktest, getIndicator, getAdjustedData } = require('../helpers/backtest');
let { getLatestPrice, fixFaulty } = require('../helpers/stock');
let { addJob } = require('../helpers/queue');

//#region Watchlist
// gets the most updated price for a stock
router.get("/latestPrice", async (req, res) => {
    let symbol = req.query.symbol;
    let entry = await getLatestPrice(symbol);
    res.json(entry);
})

// gets a user's bought symbol list
router.get("/boughtSymbols", (req, res) => {
    if (!req.session.hasOwnProperty("buys")) {
        req.session["buys"] = {};
    }
    res.json(req.session["buys"]);
})

// buy
router.get("/buySymbol", async (req, res) => {
    let symbol = req.query.symbol;
    let entry = await getLatestPrice(symbol);
    let date = entry["date"];
    let price = entry["adjClose"]

    // if first buy
    if (!req.session.hasOwnProperty("buys")) {
        req.session["buys"] = {};
    }

    // if first buy for symbol
    if (!req.session["buys"].hasOwnProperty(symbol)) {
        req.session["buys"][symbol] = [];
    }

    // add date
    if (!req.session["buys"][symbol].includes(date)) {
        req.session["buys"][symbol].push({ date, price });
    }
    console.log(req.session);
    res.json(req.session["buys"]);
});

// sell
router.get("/sellSymbol", (req, res) => {
    let symbol = req.query.symbol;

    // check buys
    if (!req.session.hasOwnProperty("buys")) {
        res.json({});
        return;
    }

    // check symbol buy
    if (!req.session["buys"].hasOwnProperty(symbol)) {
        res.json(req.session["buys"]);
        return;
    }
    else {
        delete req.session["buys"][symbol];
        console.log(req.session);
        res.json(req.session["buys"]);
    }
})
//#endregion

//#region Graphs
router.post("/indicatorGraph", async (req, res) => {
    let symbol = req.body["symbol"];
    let indicatorName = req.body["indicatorName"];
    let indicatorOptions = req.body["indicatorOptions"];

    let stockInfo = await getDocument("prices", symbol);
    if (stockInfo.length != 0) {
        let pricesJSON = stockInfo["prices"];
        let [prices, volumes, opens, highs, lows, closes, dates] = getAdjustedData(pricesJSON, null);

        let indicator = getIndicator(indicatorName, indicatorOptions, symbol, dates, prices, opens, highs, lows, closes);

        res.json(indicator.getGraph());
    }
})

// get price data for a company
router.post("/priceGraph", async (req, res) => {
    let symbol = req.body["symbol"];
    let indicators = req.body["indicators"];

    // get prices from database
    let stockInfo = await getDocument("prices", symbol);
    if (stockInfo.length != 0) {
        let pricesJSON = stockInfo["prices"];
        let [prices, volumes, opens, highs, lows, closes, dates] = getAdjustedData(pricesJSON, null);
        let atr = getIndicator("ATR", { period: 12 }, symbol, dates, prices, opens, highs, lows, closes).getGraph();

        let indicatorGraphs = {};
        Object.keys(indicators).forEach(indicatorName => {
            let indicator = getIndicator(indicatorName, indicators[indicatorName], symbol, dates, prices, opens, highs, lows, closes);
            indicatorGraphs[indicatorName] = indicator.getGraph();
        })

        res.json({ price: pricesJSON, atr: atr, volumes: volumes, indicators: indicatorGraphs });
    }
    else {
        res.json({ price: [], volumes: [], indicators: {} });
    }
});
//#endregion

module.exports = router;