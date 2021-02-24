var express = require('express');
var router = express.Router();

var yahooFinance = require('yahoo-finance');
let { getYahooBars } = require('../helpers/yahoo');
let { cancelAllBuyOrders, getOpenOrders, getAlpacaBars } = require('../helpers/alpaca');
let { getBacktestSummary, toPST } = require('../helpers/utils');
let { containsID, getDocument, setDocumentField, addDocument, getDocumentField } = require('../helpers/mongo');

router.get('/', async (req, res) => {
    // res.send(await getYahooBars("AAPL", new Date("1/1/1500"), new Date("2/19/2021"), "15Min"));
    res.send(await getAlpacaBars(["AAPL", "GOOGL", "FB", "AMZN", "NFLX", "AXP", "BAC", "COST"], new Date("1/1/1500"), new Date("2/19/2021"), "15Min"));
})

router.get('/bars', async function (req, res, next) {
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

module.exports = router;