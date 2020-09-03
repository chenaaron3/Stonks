var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');
let { getStockInfo, getDocument } = require('../helpers/mongo');
let { getIndicator } = require('../helpers/backtest');
let { clampRange } = require('../helpers/utils');
const { fork } = require('child_process');

// how many threads to spawn on each request
const NUM_THREADS = 4;

router.get("/createDataset", async (req, res) => {
    let id = req.query.id;
    let window = req.query.window;
    let result = await getDocument("results", id);
    if (typeof (result["results"]) == "string") {
        res.json({ error: "Results are not ready yet!" });
    }
    else {
        res.send("Creating dataset");
        let features = [];
        let labels = [];
        let backtestData = result["results"]["symbolData"];
        let symbols = Object.keys(backtestData);
        symbols = symbols.sort();

        // create threads that split up the work
        let finishedWorkers = 0;
        let partitionSize = Math.ceil(symbols.length / NUM_THREADS);
        for (let i = 0; i < NUM_THREADS; ++i) {
            // divy up the symbols for each thread to work on
            let partition = symbols.slice(i * partitionSize, (i + 1) * partitionSize);

            // spawn child to do work
            let child = fork(path.join(__dirname, "../helpers/worker.js"));
            child.on('message', async (msg) => {
                if (msg.status == "finished") {
                    // assign partition's results to collective results
                    features = features.concat(msg.features);
                    labels = labels.concat(msg.labels);
                    // if all worker threads are finished
                    if (++finishedWorkers == NUM_THREADS) {
                        // balance the number of win/loss events
                        let numWins = labels.filter(x => x == 0).length;
                        let numLosses = labels.length - numWins;
                        let numResults = Math.min(numWins, numLosses);

                        let trimmedFeatures = [];
                        let trimmedLabels = [];

                        numWins = 0;
                        numLosses = 0;
                        for (let i = 0; i < labels.length; ++i) {
                            if (labels[i] == 0 && numWins < numResults) {
                                trimmedFeatures.push(features[i]);
                                trimmedLabels.push(0);
                                numWins += 1;
                            }
                            else if (labels[i] == 1 && numLosses < numResults) {
                                trimmedFeatures.push(features[i]);
                                trimmedLabels.push(1);
                                numLosses += 1;
                            }
                        }

                        // write to file
                        fs.writeFileSync(path.join(__dirname, "../data", `${id}.json`), JSON.stringify({ features: trimmedFeatures, labels: trimmedLabels }));
                        console.log("Finished creating dataset!");
                    }
                }
            })
            child.send({ type: "startCreatingDataset", partition, result, window });
        }
    }
})

// generates a dataset for prediction
// features are normalized price/indicators 
// labels are win(0) or loss(1)
router.get("/createDataset", async (req, res) => {
    let id = req.query.id;
    let window = req.query.window;
    let result = await getDocument("results", id);
    if (typeof (result["results"]) == "string") {
        res.json({ error: "Results are not ready yet!" });
    }
    else {
        let features = [];
        let labels = [];
        let backtestData = result["results"]["symbolData"];
        let symbols = Object.keys(backtestData);
        symbols = symbols.sort();
        for (let symbolIndex = 0; symbolIndex < symbols.length; ++symbolIndex) {
            let symbol = symbols[symbolIndex];
            console.log(symbol);

            // gather symbol data
            let symbolData = (await getDocument("prices", symbol))["prices"];
            let prices = {};
            let opens = {};
            let highs = {};
            let lows = {};
            let closes = {};
            for (let symbolDataIndex = 0; symbolDataIndex < symbolData.length; ++symbolDataIndex) {
                let day = symbolData[symbolDataIndex];
                let formattedDate = new Date(day["date"]).toISOString();
                prices[formattedDate] = day["adjClose"];
                opens[formattedDate] = day["open"];
                highs[formattedDate] = day["high"];
                lows[formattedDate] = day["low"];
                closes[formattedDate] = day["close"];
            }

            // get sorted dates
            let dates = Object.keys(prices).sort(function (a, b) {
                return new Date(a) - new Date(b);
            });

            // load indicator data
            let indicatorOptions = result["results"]["strategyOptions"]["buyIndicators"]
            let indicatorNames = Object.keys(indicatorOptions).sort();
            let indicators = {};
            for (let indicatorIndex = 0; indicatorIndex < indicatorNames.length; ++indicatorIndex) {
                let indicatorName = indicatorNames[indicatorIndex];
                let indicator = getIndicator(indicatorName, indicatorOptions[indicatorName], symbol, dates, prices, opens, highs, lows, closes);
                indicators[indicatorName] = indicator;
            }

            // populate data with events
            let events = backtestData[symbol]["events"];
            for (let eventIndex = 0; eventIndex < events.length; ++eventIndex) {
                let event = events[eventIndex];
                let buyDate = event["buyDate"];
                let buyIndex = dates.indexOf(buyDate);
                let startIndex = buyIndex - window + 1;
                if (startIndex < 0) {
                    return;
                }
                let feature = [];
                let priceFeatures = [];

                // add price data
                for (let i = startIndex; i <= buyIndex; ++i) {
                    priceFeatures.push(prices[dates[i]]);
                }
                priceFeatures = clampRange(priceFeatures);
                feature = feature.concat(priceFeatures);

                // add indicator data
                for (let indicatorIndex = 0; indicatorIndex < indicatorNames.length; ++indicatorIndex) {
                    let indicatorName = indicatorNames[indicatorIndex];
                    let indicator = indicators[indicatorName];
                    let indicatorFeatures = []
                    // loop window size
                    for (let i = startIndex; i <= buyIndex; ++i) {
                        indicatorFeatures.push(indicator.getValue(dates[i]));
                    }
                    // console.log(indicatorName, "Before", indicatorFeatures);
                    // normalize the data
                    indicatorFeatures = indicator.normalize(indicatorFeatures);
                    // console.log(indicatorName, "After", indicatorFeatures);
                    // add indicator features
                    feature = feature.concat(indicatorFeatures);
                };

                // add to dataset
                features.push(feature);
                labels.push(event["profit"] > 0 ? 0 : 1);
            }
        };

        // save data into file
        fs.writeFileSync(path.join(__dirname, "../data", `${id}.json`), JSON.stringify({ features, labels }));
        res.send("Finished");
    }
});

module.exports = router;