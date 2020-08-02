var express = require('express');
var router = express.Router();
var path = require('path');
const { fork } = require('child_process');

// own helpers
const csv = require('csv');
let { getStockInfo, containsID, addID, getDocument } = require('../helpers/mongo');
let { makeid } = require('../helpers/utils');
let { triggerChannel } = require('../helpers/pusher');

// get backtest results
router.get("/results", async (req, res) => {
    let id = req.query.id;
    console.log(`Fetching results for id ${id}`);
    let doc = await getDocument("results", id);
    res.json(doc["results"]);
})

// get price data for a company
router.get("/priceGraph", async (req, res) => {
    let symbol = req.query["symbol"];
    let stockInfo = await getStockInfo(symbol);
    stockInfo = await stockInfo.toArray();
    if (stockInfo.length == 0) {
        res.json({});
    }
    else {
        res.json(stockInfo[0]["prices"]);
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