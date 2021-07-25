var fs = require('fs');
var path = require('path');

let { conductBacktest, findIntersections,
    conductStoplossTargetOptimization, optimizeStoplossTargetForSymbol,
    conductIndicatorOptimization, optimizeIndicatorsForSymbol } = require('../helpers/backtest');
let { updateStocks, gatherData, checkSplitForSymbol } = require('../helpers/stock');

let logDirectory = path.join(__dirname, "../logs");
let backtestPath = path.join(logDirectory, "backtestLogs.txt");
let intersectionPath = path.join(logDirectory, "intersectionLogs.txt");
let updateLogs = path.join(logDirectory, "updateLogs.txt");
let checkLogs = path.join(logDirectory, "checkLogs.txt");
let optimizeLogs = path.join(logDirectory, "optimizeLogs.txt");
let datasetPath = path.join(logDirectory, "datasetLogs.txt");

if (!fs.existsSync(logDirectory)){
    fs.mkdirSync(logDirectory);
}

process.on('message', async (msg) => {
    // thread to run backtest
    if (msg.type == "startBacktest") {
        // log start information
        const start = Date.now();
        fs.appendFileSync(backtestPath, `Worker ${msg.id}: Starting backtest\n`, { encoding: "utf-8" });

        // conduct actual backtest
        await conductBacktest(msg.strategyOptions, msg.id);
        console.log("Conduct Backtest Finished");
        // notify parent
        process.send({ status: "finished" }, null, {}, () => {
            // log end information
            let time = Math.floor((Date.now() - start) / 1000);
            fs.appendFileSync(backtestPath, `Worker ${msg.id}: Finished backtest in ${time} seconds\n`, { encoding: "utf-8" });
            process.exit(0);
        });
    }
    // thread within backtesting to find buy/sell events
    else if (msg.type == "backtestJob") {
        // log start information
        let symbols = msg.partition;
        const start = Date.now();
        let startTicker = symbols[0];
        let endTicker = symbols[symbols.length - 1];
        fs.appendFileSync(intersectionPath,
            `Worker ${msg.id}: Finding intersections for tickers ${startTicker} to ${endTicker}\n`, { encoding: "utf-8" });

        // conduct actual intersection finding
        let intersections = {};
        let updateStep = Math.floor(symbols.length / 100);
        for (let i = 0; i < symbols.length; ++i) {
            let symbol = symbols[i];

            // get info from previous results
            let previousResults = undefined;
            let lastUpdated = undefined;
            if (msg.previousResults != undefined) {
                previousResults = msg.previousResults["results"]["symbolData"][symbol];
                lastUpdated = new Date(msg.previousResults["results"]["lastUpdated"]);
            }

            try {
                // find results for the symbol
                let intersection = await findIntersections(msg.strategyOptions, symbol, previousResults, lastUpdated);
                // only record if if has buy/sell events
                if (intersection["events"].length > 0) {
                    intersections[symbol] = intersection;
                }
                console.log(`${symbol} => ${intersection["events"].length}`);

                // update progress
                if (i != 0 && i % updateStep == 0) {
                    process.send({ status: "progress", progress: updateStep });
                }
            }
            catch { }
        }
        // notify parent
        process.send({ status: "finished", intersections }, null, {}, () => {
            // log end information
            let time = Math.floor((Date.now() - start) / 1000);
            fs.appendFileSync(intersectionPath, `Worker ${msg.id}: Finished backtest for tickers ${startTicker} to ${endTicker} in ${time} seconds\n`, { encoding: "utf-8" });
            process.exit(0);
        });
    }
    // thread to optimize stoploss and targets
    else if (msg.type == "startOptimizeStoplossTarget") {
        // log start information
        const start = Date.now();
        fs.appendFileSync(optimizeLogs, `Worker ${msg.id}: Starting optimization\n`, { encoding: "utf-8" });

        // conduct actual optimization
        await conductStoplossTargetOptimization(msg.id, msg.optimizeOptions);
        console.log("Conduct Optimization Finished");
        // notify parent
        process.send({ status: "finished" }, null, {}, () => {
            // log end information
            let time = Math.floor((Date.now() - start) / 1000);
            fs.appendFileSync(optimizeLogs, `Worker ${msg.id}: Finished optimization in ${time} seconds\n`, { encoding: "utf-8" });
            process.exit(0);
        });
    }
    // thread within optimize stoploss target
    else if (msg.type == "optimizeStoplossTargetJob") {
        // log start information
        let symbols = msg.partition;
        const start = Date.now();
        let startTicker = symbols[0];
        let endTicker = symbols[symbols.length - 1];
        fs.appendFileSync(optimizeLogs,
            `Worker ${msg.id}: optimizing stoploss target tickers ${startTicker} to ${endTicker}\n`, { encoding: "utf-8" });

        // conduct actual optimization
        let optimizedData = {};
        let updateStep = Math.floor(symbols.length / 100);
        for (let i = 0; i < symbols.length; ++i) {
            let symbol = symbols[i];

            // get info from previous results
            let previousResults = msg.previousResults["results"]["symbolData"][symbol];

            // find results for the symbol
            try {
                let optimizedSymbol = await optimizeStoplossTargetForSymbol(msg.previousResults["results"]["strategyOptions"], msg.optimizeOptions, symbol, previousResults);
                optimizedData[symbol] = optimizedSymbol["results"];
                console.log(`${symbol} => ${(optimizedSymbol["effective"] / optimizedSymbol["count"] * 100).toFixed(0)}% (${optimizedSymbol["effective"] + "/" + optimizedSymbol["count"]})`);
    
                // update progress
                if (i != 0 && i % updateStep == 0) {
                    process.send({ status: "progress", progress: updateStep });
                }
            }
            catch {}
        }
        // notify parent
        process.send({ status: "finished", optimizedData }, null, {}, () => {
            // log end information
            let time = Math.floor((Date.now() - start) / 1000);
            fs.appendFileSync(optimizeLogs, `Worker ${msg.id}: Finished optimizing stoploss target tickers ${startTicker} to ${endTicker} in ${time} seconds\n`, { encoding: "utf-8" });
            process.exit(0);
        });
    }
    // thread to optimize indicators
    else if (msg.type == "startOptimizeIndicators") {
        // log start information
        const start = Date.now();
        fs.appendFileSync(optimizeLogs, `Worker ${msg.id}: Starting indicator optimization\n`, { encoding: "utf-8" });

        // conduct actual optimization
        await conductIndicatorOptimization(msg.id, msg.indicatorOptions);
        console.log("Conduct Indicator Optimization Finished");
        // notify parent
        process.send({ status: "finished" }, null, {}, () => {
            // log end information
            let time = Math.floor((Date.now() - start) / 1000);
            fs.appendFileSync(optimizeLogs, `Worker ${msg.id}: Finished indicator optimization in ${time} seconds\n`, { encoding: "utf-8" });
            process.exit(0);
        });
    }
    // thread within optimize indicators
    else if (msg.type == "optimizeIndicatorsJob") {
        // log start information
        let symbols = msg.partition;
        const start = Date.now();
        let startTicker = symbols[0];
        let endTicker = symbols[symbols.length - 1];
        fs.appendFileSync(optimizeLogs,
            `Worker ${msg.id}: optimizing indicators tickers ${startTicker} to ${endTicker}\n`, { encoding: "utf-8" });

        // conduct actual optimization
        let optimizedData = {};
        let updateStep = Math.floor(symbols.length / 100);
        for (let i = 0; i < symbols.length; ++i) {
            let symbol = symbols[i];

            // get info from previous results
            let previousResults = msg.previousResults["results"]["symbolData"][symbol];
            let strategyOptions = msg.previousResults["results"]["strategyOptions"];

            // find results for the symbol
            try {
                let optimizedSymbol = await optimizeIndicatorsForSymbol(msg.indicatorOptions, symbol, previousResults, strategyOptions);
                optimizedData[symbol] = optimizedSymbol;
                console.log(`${symbol} => DONE`);
    
                // update progress
                if (i != 0 && i % updateStep == 0) {
                    process.send({ status: "progress", progress: updateStep });
                }
            }
            catch {}
        }
        // notify parent
        process.send({ status: "finished", optimizedData }, null, {}, () => {
            // log end information
            let time = Math.floor((Date.now() - start) / 1000);
            fs.appendFileSync(optimizeLogs, `Worker ${msg.id}: Finished optimizing stoploss target tickers ${startTicker} to ${endTicker} in ${time} seconds\n`, { encoding: "utf-8" });
            process.exit(0);
        });
    }
    // thread to run updates
    else if (msg.type == "startUpdate") {
        // log start information
        let updateDate = new Date();
        // updateDate.setDate(updateDate.getDate() + 1); // used to test updates
        let documents = msg.partition;
        const start = Date.now();
        let startTicker = documents[0]._id;
        let endTicker = documents[documents.length - 1]._id;
        fs.appendFileSync(updateLogs,
            `Worker ${msg.updateID}: Starting update for tickers ${startTicker} to ${endTicker}\n`, { encoding: "utf-8" })

        // start actual updates
        for (let i = 0; i < documents.length; ++i) {
            let document = documents[i];
            // update the stock
            await updateStocks(document, updateDate, msg.timeframe);
        }
        // notify parent
        process.send({ status: "finished" }, null, {}, () => {
            // log end information
            let time = Math.floor((Date.now() - start) / 1000);
            fs.appendFileSync(updateLogs,
                `Worker ${msg.updateID}: Finished update for tickers ${startTicker} to ${endTicker} in ${time} seconds\n`, { encoding: "utf-8" })
            process.exit(0);
        });
    }
    // thread to check for splits
    else if (msg.type == "startSplitCheck") {
        // log start information
        let documents = msg.partition;
        const start = Date.now();
        let startTicker = documents[0]._id;
        let endTicker = documents[documents.length - 1]._id;
        fs.appendFileSync(checkLogs,
            `Worker ${msg.jobID}: Starting split check for tickers ${startTicker} to ${endTicker}\n`, { encoding: "utf-8" })

        let changes = 0;
        // start actual checks
        for (let i = 0; i < documents.length; ++i) {
            let document = documents[i];
            // check the stock
            changes += await checkSplitForSymbol(document);
        }
        // notify parent
        process.send({ status: "finished", changes }, null, {}, () => {
            // log end information
            let time = Math.floor((Date.now() - start) / 1000);
            fs.appendFileSync(checkLogs,
                `Worker ${msg.jobID}: Finished split check for tickers ${startTicker} to ${endTicker} in ${time} seconds\n`, { encoding: "utf-8" })
            process.exit(0);
        });
    }
    // thread to create dataset for ML
    else if (msg.type == "startCreatingDataset") {
        // log start information
        let symbols = msg.partition;
        const start = Date.now();
        let startTicker = symbols[0];
        let endTicker = symbols[symbols.length - 1];
        fs.appendFileSync(datasetPath,
            `Worker ${msg.id}: Creating dataset for tickers ${startTicker} to ${endTicker}\n`, { encoding: "utf-8" });

        // conduct actual data gathering
        let data = await gatherData(symbols, msg.result, msg.window);
        // notify parent
        process.send({ status: "finished", ...data }, null, {}, () => {
            // log end information
            let time = Math.floor((Date.now() - start) / 1000);
            fs.appendFileSync(datasetPath, `Worker ${msg.id}: Finished gathering data for tickers ${startTicker} to ${endTicker} in ${time} seconds\n`, { encoding: "utf-8" });
            process.exit(0);
        });
    }
});