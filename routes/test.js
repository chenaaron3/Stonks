var express = require('express');
var router = express.Router();

var yahooFinance = require('yahoo-finance');
let { getYahooBars } = require('../helpers/yahoo');
let { getOpenOrders, getAlpacaBars } = require('../helpers/alpaca');
let { getBacktestSummary, getAdjustedData } = require('../helpers/utils');
let { containsID, getDocument, setDocumentField, addDocument, getDocumentField } = require('../helpers/mongo');
let { getSymbols, getIndicator } = require('../helpers/backtest');

router.get('/', async (req, res) => {
    // res.send(await getYahooBars("AAPL", new Date("1/1/1500"), new Date("2/19/2021"), "15Min"));
    res.send(await getAlpacaBars("DHX", new Date("1/1/1500"), new Date("2/19/2021"), "1Hour"));
})

router.get('/bars', async function (req, res, next) {
    console.log(req.session);
    res.send("ok")

    let symbol = req.query.symbol;
    
    let alpacaBars = await getAlpacaBars("AAPL", new Date("1/1/2018"), new Date("5/30/2021"), "1Hour")
    let yahooBars = await getYahooBars("AAPL", new Date("4/1/2021"), new Date(), "1Day")
});

// recalcualte summary for testing
router.get("/summarize", async function (req, res) {
    let symbol = req.query.symbol;
    let id = "Z5vJVqgB9E";

    let doc = await getDocument("results", id);

    let optimized = doc["_optimized"];
    if (optimized) {
        if (id != optimized["base"]) {
            doc = await getDocument("results", optimized["base"]);
            optimized = doc["_optimized"];
        }
        let results = {};
        // fetch all docs
        for (let i = 0; i < optimized["ids"].length; ++i) {
            let optimizedID = optimized["ids"][i];
            getDocumentField("results", optimizedID, ["summary", "results.strategyOptions"])
                .then(async (doc) => {
                    let summary = doc["summary"];
                    // double check if valid summary exists
                    console.log("Upating summary for " + optimizedID);
                    let d = await getDocument("results", optimizedID);
                    summary = getBacktestSummary(d["results"]);
                    await setDocumentField("results", optimizedID, "summary", summary);
                });
        }
    }
    else {
        res.json({ error: "Backtest not optimized yet!" });
    }

    res.json({})
});

router.post('/indicator', async (req, res) => {
    let symbol = req.body["symbol"];
    let indicatorName = req.body["indicatorName"];
    let indicatorOptions = req.body["indicatorOptions"];
    let timeframe = req.body["timeframe"] ? req.body["timeframe"] : "day";

    let stockInfo = await getDocument("prices" + timeframe, symbol);
    if (stockInfo.length != 0) {
        let pricesJSON = stockInfo["prices"];
        let [prices, volumes, opens, highs, lows, closes, dates] = getAdjustedData(pricesJSON, null);

        let indicator = getIndicator(indicatorName, indicatorOptions, symbol, dates, prices, opens, highs, lows, closes);

        for(let i = 0; i < dates.length; ++i) {
            indicator.getAction(dates[i], i, false);
        }

        res.json(indicator.getGraph());
    }
})

module.exports = router;