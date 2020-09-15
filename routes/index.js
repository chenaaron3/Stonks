var express = require('express');
var router = express.Router();
var path = require('path');
const { fork } = require('child_process');

// own helpers
const csv = require('csv');
let { getStockInfo, containsID, addID, getDocument } = require('../helpers/mongo');
let { makeid } = require('../helpers/utils');
let { triggerChannel } = require('../helpers/pusher');
let { getIndicator } = require('../helpers/backtest');
let { getLatestPrice } = require('../helpers/stock');

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
        req.session["buys"][symbol].push({date, price});
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

        let indicatorGraphs = {};
        Object.keys(indicators).forEach(indicatorName => {
            let indicator = getIndicator(indicatorName, indicators[indicatorName], symbol, dates, prices, opens, highs, lows, closes);
            indicatorGraphs[indicatorName] = indicator.getGraph();
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
    let doc = await getDocument("results", id);
    let strategyOptions = doc.results["strategyOptions"];
    res.send("Updating backtest!");

    // spawn child to do work
    let child = fork(path.join(__dirname, "../helpers/worker.js"));
    child.send({ type: "startBacktest", strategyOptions, id });
    child.on('message', function (message) {
        console.log(message);
        if (message.status == "finished") {
            console.log("Trigger client", id);
            triggerChannel(id, "onUpdateFinished", { id: `${id}` });
        }
    });
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
    // send response so doesn't hang and gets the unique id
    res.json({ "id": id });

    // spawn child to do work
    let child = fork(path.join(__dirname, "../helpers/worker.js"));
    child.send({ type: "startBacktest", strategyOptions, id });
    child.on('message', function (message) {
        console.log(message);
        if (message.status == "finished") {
            console.log("Trigger client", id);
            triggerChannel(id, "onResultsFinished", { id: `${id}` });
        }
    });
})

module.exports = router;