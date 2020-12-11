var express = require('express');
var router = express.Router();
var path = require('path');
const { fork } = require('child_process');

// own helpers
const csv = require('csv');
let { getStockInfo, containsID, addID, getDocument, setDocumentField, addActiveResult, deleteActiveResult } = require('../helpers/mongo');
let { makeid, daysBetween } = require('../helpers/utils');
let { triggerChannel } = require('../helpers/pusher');
let { backtest, updateBacktest, getIndicator, getAdjustedData } = require('../helpers/backtest');
let { getLatestPrice } = require('../helpers/stock');
let { addJob } = require('../helpers/queue');

router.post("/autoUpdate", async (req, res) => {
    // id of the result
    let id = req.body.id;
    // email to notify when update is finished
    let email = req.body.email;
    // sessionID of client to get watchlist
    let sessionID = req.sessionID;

    if (req.body.subscribe) {
        await addActiveResult({ id, email, sessionID });
        res.json({ status: "Added backtest to daily updates!" });
    }
    else {
        await deleteActiveResult({ id, email, sessionID });
        res.json({ status: "Removed backtest from daily updates!" });
    }
});

router.get("/isAutoUpdate", async (req, res) => {
    // each session and backtest can only have 1 email
    let id = req.query.id;
    let sessionID = req.sessionID;

    let found = false;
    let activeResults;
    try {
        activeResults = await getDocument("results", "activeResults");
        activeResults = activeResults["activeResults"];
        for (let i = 0; i < activeResults.length; ++i) {
            let activeResult = activeResults[i];
            if (activeResult["id"] == id && activeResult["sessionID"] == sessionID) {
                found = true;
                break;
            }
        }
    }
    catch(e){
        // no active results
        found = false;
    }

    res.json({ status: found });
})

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

// get backtest results
router.get("/results", async (req, res) => {
    let id = req.query.id;
    let doc = await getDocument("results", id);
    if (typeof (doc["results"]) == "string") {
        res.json({ error: "Results are not ready yet!" });
    }
    else {
        res.json(doc["results"]);
    }
})

// start fake backtesting for testing
router.get("/fakeBacktest", async (req, res) => {
    let id = req.query.id;
    res.json({ "id": id });
    setTimeout(() => {
        triggerChannel(id, "onResultsFinished", { id: `${id}` });
    }, 1000);
})

router.post("/indicatorGraph", async (req, res) => {
    let symbol = req.body["symbol"];
    let indicatorName = req.body["indicatorName"];
    let indicatorOptions = req.body["indicatorOptions"];

    let stockInfo = await getStockInfo(symbol);
    stockInfo = await stockInfo.toArray();
    if (stockInfo.length != 0) {
        let pricesJSON = stockInfo[0]["prices"];
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
    let stockInfo = await getStockInfo(symbol);
    stockInfo = await stockInfo.toArray();
    if (stockInfo.length != 0) {
        let pricesJSON = stockInfo[0]["prices"];
        let [prices, volumes, opens, highs, lows, closes, dates] = getAdjustedData(pricesJSON, null);

        let indicatorGraphs = {};
        Object.keys(indicators).forEach(indicatorName => {
            let indicator = getIndicator(indicatorName, indicators[indicatorName], symbol, dates, prices, opens, highs, lows, closes);
            indicatorGraphs[indicatorName] = indicator.getGraph();
            if (indicatorName == "Structure" || indicatorName == "SMA") {
                dates.forEach(day => {
                    indicator.getAction(day);
                })
            }
        })

        res.json({ price: pricesJSON, indicators: indicatorGraphs });
    }
    else {
        res.json({ price: [], indicators: {} });
    }
});

router.get("/updateBacktest", async (req, res) => {
    // get backtest id
    let id = req.query.id;
    if (!await containsID(id)) {
        res.send("Backtest ID is not valid!");
        return;
    }

    let position = updateBacktest(id);

    if (position == 0) {
        res.json({ status: "Updating your backtest!" });
    }
    else {
        res.json({ status: `Backtest update will start within ${30 * position} minutes!` });
    }
});

// gets the backtest results for all companies
router.post("/backtest", async (req, res) => {
    // get options from client
    let strategyOptions = req.body;

    // create unique id
    let id = makeid(10);
    while (await containsID(id)) {
        id = makeid(10);
    }

    // add id to the database
    addID(id);

    let position = backtest(id, strategyOptions);

    // send response so doesn't hang and gets the unique id
    if (position == 0) {
        res.json({ id, status: "Starting your backtest!" });
    }
    else {
        res.json({ id, status: `Backtest will start within ${30 * position} minutes!` });
    }
})

module.exports = router;