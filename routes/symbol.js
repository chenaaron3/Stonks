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
router.get("/boughtSymbols", async (req, res) => {
    // if not logged in
    if (!req.user) {
        if (!req.session.hasOwnProperty("buys")) {
            req.session["buys"] = {};
        }
        res.json(req.session["buys"]);
    }
    // if logged in
    else {
        let user = await getDocument("users", req.user.username);
        res.json(user["buys"]);
    }

})

// buy
router.get("/buySymbol", async (req, res) => {
    let symbol = req.query.symbol;
    let entry = await getLatestPrice(symbol);
    let date = entry["date"];
    let price = entry["close"]

    let buyDict = undefined;

    if (!req.user) {
        // if first buy
        if (!req.session.hasOwnProperty("buys")) {
            req.session["buys"] = {};
        }
        buyDict = req.session["buys"];
    }
    else {
        buyDict = (await getDocumentField("users", req.user.username, ["buys"]))["buys"];
    }

    // if first buy for symbol
    if (!buyDict.hasOwnProperty(symbol)) {
        buyDict[symbol] = [];
    }

    // add date
    if (!buyDict[symbol].includes(date)) {
        buyDict[symbol].push({ date, price });
    }

    // store back into db
    if (req.user) {
        await setDocumentField("users", req.user.username, "buys", buyDict, {});
    }

    res.json(buyDict);

});

// sell
router.get("/sellSymbol", async (req, res) => {
    let symbol = req.query.symbol;

    if (!req.user) {
        // check buys
        if (!req.session.hasOwnProperty("buys")) {
            res.json({});
            return;
        }
    }

    let buyDict = !req.user ? req.session["buys"] : (await getDocumentField("users", req.user.username, ["buys"]))["buys"];

    // check symbol buy
    if (!buyDict.hasOwnProperty(symbol)) {
        res.json(buyDict);
        return;
    }
    else {
        delete buyDict[symbol];
        if (req.user) {
            await setDocumentField("users", req.user.username, "buys", buyDict, {});
        }
        res.json(buyDict);
    }
})
//#endregion

//#region Graphs
router.post("/indicatorGraph", async (req, res) => {
    let symbol = req.body["symbol"];
    let indicatorName = req.body["indicatorName"];
    let indicatorOptions = req.body["indicatorOptions"];
    let timeframe = req.body["timeframe"] ? req.body["timeframe"] : "day";

    let stockInfo = await getDocument("prices" + timeframe, symbol);
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
    let timeframe = req.body["timeframe"] ? req.body["timeframe"] : "day";

    // get prices from database
    let stockInfo = await getDocument("prices" + timeframe, symbol);
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