var express = require('express');
var router = express.Router();

var yahooFinance = require('yahoo-finance');
let { getYahooBars } = require('../helpers/yahoo');
let { cancelAllBuyOrders, getOpenOrders, getAlpacaBars } = require('../helpers/alpaca');
let { getBacktestSummary, toPST } = require('../helpers/utils');
let { containsID, getDocument, setDocumentField, addDocument, getDocumentField } = require('../helpers/mongo');
let { getSymbols, getIndicator, getAdjustedData } = require('../helpers/backtest');

router.get('/', async (req, res) => {
    // res.send(await getYahooBars("AAPL", new Date("1/1/1500"), new Date("2/19/2021"), "15Min"));
    res.send(await getAlpacaBars("DHX", new Date("1/1/1500"), new Date("2/19/2021"), "15Min"));
})

router.get('/bars', async function (req, res, next) {
    console.log(req.session);
    res.send("ok")

    let symbol = req.query.symbol;
    let symbols = await getSymbols(false);
    symbols = symbols.slice(0, 200);
    console.log(symbols, symbols.length);
    let from = new Date("5/1/2020")
    let start = Date.now();

    // console.log(start);
    // let aggregated = await yahooFinance.historical({
    //     symbols: symbols,
    //     from: from,
    //     to: new Date(),
    //     period: 'd'  // 'd' (daily), 'w' (weekly), 'm' (monthly), 'v' (dividends only)
    // });
    // let time = Math.floor((Date.now() - start) / 1000);
    // console.log("aggregate time", time);
    // res.json(aggregated);

    start = Date.now();
    console.log(start);
    let faulty = 0;
    for (let i = 0; i < symbols.length; ++i) {
        let symbol = symbols[i];
        let bars = await getAlpacaBars(symbol, from, new Date(), '15Min');
        if (bars.length == 0) {
            faulty += 1;
            console.log("Faulty found", faulty, "Covered", i)
        }
        else {
            console.log(symbol, bars.length);
        }
    }
    console.log("Total:", symbols.length, "Faulty:", faulty);
    let time = Math.floor((Date.now() - start) / 1000);
    console.log("aggregate time", time);
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