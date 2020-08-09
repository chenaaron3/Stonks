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

// get backtest results
router.get("/results", async (req, res) => {
    let id = req.query.id;
    console.log(`Fetching results for id ${id}`);
    let doc = await getDocument("results", id);
    res.json(doc["results"]);
})

// start fake backtesting for testing
router.get("/fakeBacktest", async (req, res) => {
    let id = req.query.id;
    res.json({ "id": id });
    setTimeout(() => {
        triggerChannel(id, "onResultsFinished", `${id}`);
    }, 1000);
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
        pricesJSON.forEach(day => {
            let formattedDate = new Date(day["date"]).toISOString();
            prices[formattedDate] = day["adjClose"];
        });
        // get sorted dates
        let dates = Object.keys(prices).sort(function (a, b) {
            return new Date(a) - new Date(b);
        });

        let indicatorGraphs = {};
        Object.keys(indicators).forEach(indicatorName => {
            let indicator = getIndicator(indicatorName, indicators[indicatorName], symbol, dates, prices);
            indicatorGraphs[indicatorName] = indicator.getGraph();
        })
        
        res.json({ price: pricesJSON, indicators: indicatorGraphs });
    }
    else {
        res.json({ price: [], indicators: {} });
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
    // send response so doesn't hang and gets the unique id
    res.json({ "id": id });

    // spawn child to do work
    let child = fork(path.join(__dirname, "../helpers/worker.js"));
    child.send({ type: "startBacktest", strategyOptions, id });
    child.on('message', function (message) {
        console.log(message);
        if (message.status == "finished") {
            console.log("Trigger client", id);
            triggerChannel(id, "onResultsFinished", `${id}`);
        }
    });
})

module.exports = router;