var express = require('express');
var router = express.Router();
var path = require('path');
const { fork } = require('child_process');

// own helpers
const csv = require('csv');
let { containsID, addDocument, getDocument, addActiveResult, deleteActiveResult, deleteDocument, getDocumentField, setDocumentField } = require('../helpers/mongo');
let { makeid, daysBetween, getBacktestSummary, getAdjustedData } = require('../helpers/utils');
let { triggerChannel } = require('../helpers/pusher');
let { backtest, optimizeStoplossTarget, optimizeIndicators, updateBacktest, getIndicator } = require('../helpers/backtest');
let { getLatestPrice, fixFaulty } = require('../helpers/stock');
let { addJob } = require('../helpers/queue');

//#region Backtest Status
router.post("/autoUpdate", async (req, res) => {
    if (req.user) {
        // id of the result
        let id = req.body.id;
        // email to notify when update is finished
        let email = req.user.username;

        if (req.body.subscribe) {
            await addActiveResult({ id, email });
            res.json({ status: "Added backtest to daily updates!" });
        }
        else {
            await deleteActiveResult({ id, email });
            res.json({ status: "Removed backtest from daily updates!" });
        }
    }
    else {
        res.json({ error: "You must be logged in to setup auto updates!" });
    }
});

router.get("/isAutoUpdate", async (req, res) => {
    // each session and backtest can only have 1 email
    let id = req.query.id;

    let found = false;
    if (req.user) {
        let activeResults = await getDocument("results", "activeResults");
        if (activeResults) {
            activeResults = activeResults["activeResults"];
            for (let i = 0; i < activeResults.length; ++i) {
                let activeResult = activeResults[i];
                if (activeResult["id"] == id && activeResult["email"] == req.user.username) {
                    found = true;
                    break;
                }
            }
        }
    }

    res.json({ status: found });
})
//#endregion

//#region Create Backtest
// gets the backtest results for all companies
router.post("/backtest", async (req, res) => {
    // get options from client
    let strategyOptions = req.body;

    // create unique id
    let id = makeid(10);
    while (await containsID("results", id)) {
        id = makeid(10);
    }

    // add id to the database
    addDocument("results", {
        "_id": id,
        "results": 'Results are not ready yet!'
    });

    let position = backtest(id, strategyOptions);

    // send response so doesn't hang and gets the unique id
    if (position == 0) {
        res.json({ id, status: "Starting your backtest!" });
    }
    else {
        res.json({ id, status: `Backtest will start within ${30 * position} minutes!` });
    }
});

// optimize a backtest for optimal stoploss/target
router.post("/optimizeStoplossTarget", async (req, res) => {
    // get options from client
    let optimizeOptions = req.body;
    let id = req.body["id"];

    // get the base id
    if (id.includes("optimized")) {
        let optimized = await getDocumentField("results", id, ["_optimized"]);
        id = optimized["_optimized"]["base"];
    }

    let position = optimizeStoplossTarget(id, optimizeOptions);

    // send response so doesn't hang and gets the unique id
    if (position == 0) {
        res.json({ id, status: "Starting your optimization!" });
    }
    else {
        res.json({ id, status: `Optimization will start within ${30 * position} minutes!` });
    }
})

// optimize a backtest for optimal indicators
router.post("/optimizeIndicators", async (req, res) => {
    // get options from client
    let id = req.body["id"];
    let indicatorOptions = {
        "RSI": {
            "period": 14
        },
        "MACD": {
            "ema1": 12,
            "ema2": 26,
            "signalPeriod": 9
        },
        "ADX": {
            "period": 14,
        },
        "Stochastic": {
            "period": 14
        }
    }

    // get the base id
    if (id.includes("optimized")) {
        let optimized = await getDocumentField("results", id, ["_optimized"]);
        id = optimized["_optimized"]["base"];
    }

    let position = optimizeIndicators(id, indicatorOptions);

    // send response so doesn't hang and gets the unique id
    if (position == 0) {
        res.json({ id, status: "Starting your optimization!" });
    }
    else {
        res.json({ id, status: `Optimization will start within ${30 * position} minutes!` });
    }
})
//#endregion

//#region Read Backtest
// get backtest results
router.get("/results", async (req, res) => {
    let id = req.query.id;
    try {
        let doc = await getDocument("results", id);
        if (typeof (doc["results"]) == "string") {
            res.json({ error: "Results are not ready yet!" });
        }
        else {
            res.json(doc["results"]);
        }
    }
    catch {
        res.json({ error: "Backtest does not exist!" });
    }
})

// get optimization results
router.get("/optimizedStoplossTarget", async (req, res) => {
    let id = req.query.id;
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
                    if (!summary) {
                        console.log("Upating summary for " + optimizedID);
                        let d = await getDocument("results", optimizedID);
                        summary = getBacktestSummary(d["results"]);
                        await setDocumentField("results", optimizedID, "summary", summary);
                    }
                    // return the summary and optionsW
                    results[optimizedID] = { summary: summary, strategyOptions: doc["results"]["strategyOptions"] };
                    if (Object.keys(results).length == optimized["ids"].length) {
                        res.json({ id: optimized["base"], results });
                    }
                });
        }
    }
    else {
        res.json({ error: "Backtest not optimized yet!" });
    }
})

// get optimized indicators
router.get("/optimizedIndicators", async (req, res) => {
    let id = req.query.id;

    let doc = await getDocumentField("results", id, ["_optimized"]);
    let optimized = doc["_optimized"];
    // use base id
    if (optimized && optimized["base"]) {
        id = optimized["base"];
    }

    // get doc
    try {
        doc = await getDocument("indicators", id);
        res.json(doc);
    }
    catch {
        res.json({ error: "Backtest not optimized yet!" });
    }
});
//#endregion

//#region Update Backtest
router.get("/updateBacktest", async (req, res) => {
    // get backtest id
    let id = req.query.id;
    if (!await containsID("results", id)) {
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
//#endregion

//#region Delete Backtest
// delete backtest results
router.delete("/deleteResults/:id", async (req, res) => {
    let id = req.params.id;

    let dependents = [];
    let results = [];
    let activeResults;
    // find list of people subscribed to this backtest
    activeResults = await getDocument("results", "activeResults");
    if (activeResults) {
        activeResults = activeResults["activeResults"];
        for (let i = 0; i < activeResults.length; ++i) {
            let activeResult = activeResults[i];
            if (activeResult["id"] == id) {
                dependents.push(activeResult["email"]);
                results.push(activeResult);
            }
        }
    }

    // if user subscribed, unsubscribe them
    if (req.user && dependents.includes(req.user.username)) {
        let index = dependents.indexOf(req.user.username);
        await deleteActiveResult(results[index]);
        // remove user from subscribed list
        dependents.splice(index, 1);
    }

    // cannot delete if more users are subscribed
    if (id.includes("optimized") || dependents.length > 0) {
        console.log("Cannot delete backtest, used by", dependents);
        res.json({ status: "Cannot be deleted. Being used by others." });
    }
    else {
        res.json({ status: "Deleting" });
        // delete all the linked optimized docs if any
        let optimized = await getDocumentField("results", id, ["_optimized"]);
        if (optimized && optimized["_optimized"]) {
            let optimizedIDs = optimized["_optimized"]["ids"];
            console.log("Deleting " + optimizedIDs.length + " optimized docs");
            for (let i = 0; i < optimizedIDs.length; ++i) {
                await deleteDocument("results", optimizedIDs[i]);
            }
        }
        // delete main doc
        deleteDocument("results", id);
    }
})
//#endregion

module.exports = router;