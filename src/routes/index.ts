import express, { Request, Response } from 'express';
const router = express.Router();

// own helpers
import { containsID, addDocument, getDocument, addActiveResult, deleteActiveResult, deleteDocument, getDocumentField, setDocumentField } from '../helpers/mongo';
import { makeid, getBacktestSummary } from '../helpers/utils';
import { backtest, optimizeStoplossTarget, optimizeIndicators, updateBacktest } from '../helpers/backtest';

import { MongoActiveResults, MongoResults, MongoIndicators } from '../types/types';
import Backtest from '@shared/backtest';
import Indicator from '@shared/indicator';

import API from '@shared/api';

//#region Backtest Status
router.post("/autoUpdate", async (
    req: Request<{}, {}, API.Index.PostAutoUpdate>,
    res: Response<API.Index._PostAutoUpdate>) => {
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

router.get("/isAutoUpdate", async (
    req: Request<{}, {}, {}, API.Index.GetIsAutoUpdate>,
    res: Response<API.Index._GetIsAutoUpdate>) => {
    // each session and backtest can only have 1 email
    let id = req.query.id;

    let found = false;
    if (req.user) {
        let activeResults = await getDocument<MongoActiveResults>('metadata', "activeResults");
        if (activeResults && activeResults.hasOwnProperty('activeResults')) {
            let activeResultsList = activeResults["activeResults"];
            for (let i = 0; i < activeResultsList.length; ++i) {
                let activeResult = activeResultsList[i];
                if (activeResult["id"] == id && activeResult["email"] == req.user.username) {
                    found = true;
                    break;
                }
            }
        }
    }

    res.json({ found: found });
})
//#endregion

//#region Create Backtest
// gets the backtest results for all companies
router.post("/backtest", async (
    req: Request<{}, {}, API.Index.PostBacktest>,
    res: Response<API.Index._PostBacktest>) => {
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
router.post("/optimizeStoplossTarget", async (
    req: Request<{}, {}, API.Index.PostOptimizeStoplossTarget>,
    res: Response<API.Index._PostOptimizeStoplossTarget>) => {
    // get options from client
    let optimizeOptions = req.body;
    let id = req.body.id;

    // get the base id
    if (id.includes("optimized")) {
        let optimized = await getDocumentField<MongoResults>("results", id, ["_optimized"]);
        if (!optimized) {
            res.json({ error: 'Missing Results!' });
            return;
        }
        id = optimized["_optimized"]!["base"];
    }

    let position = optimizeStoplossTarget(id, optimizeOptions);

    // send response so doesn't hang and gets the unique id
    if (position == 0) {
        res.json({ id, status: "Starting your optimization!" });
    }
    else {
        if (position) {
            res.json({ id, status: `Optimization will start within ${30 * position} minutes!` });
        }
    }
})

// optimize a backtest for optimal indicators
router.post("/optimizeIndicators", async (
    req: Request<{}, {}, API.Index.PostOptimizeIndicators>,
    res: Response<API.Index._PostOptimizeIndicators>) => {
    // get options from client
    let id = req.body.id;
    let indicatorOptions: Indicator.Indicators = {
        "RSI": {
            "period": 14,
            "underbought": 30,
            "overbought": 70
        },
        "MACD": {
            "ema1": 12,
            "ema2": 26,
            "signalPeriod": 9
        },
        "ADX": {
            "period": 14,
            "threshold": 25
        },
        "Stochastic": {
            "period": 14,
            "underbought": 20,
            "overbought": 80
        }
    }

    // get the base id
    if (id.includes("optimized")) {
        let optimized = await getDocumentField<MongoResults>("results", id, ["_optimized"]);
        if (!optimized) {
            res.json({ error: 'Missing Results!' });
            return;
        }
        id = optimized["_optimized"]!["base"];
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
router.get("/results", async (
    req: Request<{}, {}, {}, API.Index.GetResults>,
    res) => {
    let id = req.query.id;
    try {
        let doc = await getDocument<MongoResults>("results", id);
        if (!doc) {
            res.json({ error: "Backtest does not exist!" });
        }
        else if (typeof (doc["results"]) == "string") {
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
router.get("/optimizedStoplossTarget", async (
    req: Request<{}, {}, {}, API.Index.GetOptimizedStoplossTarget>,
    res: Response<API.Index._GetOptimizedStoplossTarget>) => {
    let id = req.query.id;
    let doc = await getDocument<MongoResults>("results", id);
    if (!doc) {
        res.json({ error: "Backtest does not exist!" });
        return;
    }
    let optimized = doc["_optimized"];
    if (optimized) {
        if (id != optimized["base"]) {
            doc = await getDocument<MongoResults>("results", optimized["base"]);
            if (!doc) {
                res.json({ error: 'Missing Results!' });
                return;
            }
            optimized = doc["_optimized"]!;
        }
        let results: Backtest.OptimizeStoplossTargetResults = {};
        // fetch all docs
        for (let i = 0; i < optimized["ids"]!.length; ++i) {
            let optimizedID = optimized["ids"]![i];
            getDocumentField<MongoResults>("results", optimizedID, ["summary", "results.strategyOptions"])
                .then(async (doc) => {
                    if (!doc) {
                        res.json({ error: 'Missing Results!' });
                        return;
                    }
                    let summary = doc["summary"];
                    // double check if valid summary exists
                    if (!summary) {
                        console.log("Upating summary for " + optimizedID);
                        let d = await getDocument<MongoResults>("results", optimizedID);
                        if (!d) {
                            res.json({ error: 'Missing Results!' });
                            return;
                        }
                        summary = getBacktestSummary(d["results"]);
                        await setDocumentField("results", optimizedID, "summary", summary, undefined);
                    }
                    // return the summary and options
                    results[optimizedID] = { summary: summary, strategyOptions: doc["results"]["strategyOptions"] };
                    if (Object.keys(results).length == optimized!["ids"]!.length) {
                        res.json({ id: optimized!["base"], results });
                    }
                });
        }
    }
    else {
        res.json({ error: "Backtest not optimized yet!" });
    }
})

// get optimized indicators
router.get("/optimizedIndicators", async (
    req: Request<{}, {}, {}, API.Index.GetOptimizedIndicators>,
    res: Response<API.Index._GetOptimizedIndicators>) => {
    let id = req.query.id;

    let doc = await getDocumentField<MongoResults>("results", id, ["_optimized"]);
    if (!doc) {
        res.json({ error: 'Missing Results!' });
        return;
    }
    let optimized = doc["_optimized"];
    // use base id
    if (optimized && optimized["base"]) {
        id = optimized["base"];
    }

    // get doc
    try {
        let indicatorDoc = await getDocument<MongoIndicators>("indicators", id);
        if (indicatorDoc) {
            res.json(indicatorDoc.data);
        }
        else {
            res.json({ error: "Optimization does not exist!" });
        }
    }
    catch {
        res.json({ error: "Backtest not optimized yet!" });
    }
});
//#endregion

//#region Update Backtest
router.get("/updateBacktest", async (
    req: Request<{}, {}, {}, API.Index.GetUpdateBacktest>,
    res: Response<API.Index._GetUpdateBacktest>) => {
    // get backtest id
    let id = req.query.id;
    if (!await containsID("results", id)) {
        res.json({ error: "Backtest ID is not valid!" });
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
router.delete("/deleteResults", async (
    req: Request<{}, {}, {}, API.Index.DeleteDeleteResults>,
    res: Response<API.Index._DeleteDeleteResults>) => {
    let id = req.query.id;

    let dependents = [];
    let results = [];
    // find list of people subscribed to this backtest
    let activeResultsDoc = await getDocument<MongoActiveResults>("results", "activeResults");;
    if (activeResultsDoc) {
        let activeResults = activeResultsDoc.activeResults;
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

export =router;