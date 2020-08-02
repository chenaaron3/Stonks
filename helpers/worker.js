var fs = require('fs');
var path = require('path');

let { conductBacktest, findIntersections } = require('../helpers/backtest');
let { updateStock } = require('../helpers/stock');

let logDirectory = path.join(__dirname, "../logs");

process.on('message', async (msg) => {
    // thread to run backtest
    if (msg.type == "startBacktest") {
        // log start information
        const start = Date.now();
        fs.appendFileSync(logDirectory + `\\backtestLogs.txt`, `Worker ${msg.id}: Starting backtest\n`, { encoding: "utf-8" });

        // conduct actual backtest
        await conductBacktest(msg.strategyOptions, msg.id);
        // notify parent
        process.send({ status: "finished" });

        // log end information
        let time = Math.floor((Date.now() - start) / 1000);
        fs.appendFileSync(logDirectory + `\\backtestLogs.txt`, `Worker ${msg.id}: Finished backtest in ${time} seconds\n`, { encoding: "utf-8" });
        process.exit(0);
    }
    // thread within backtesting to find buy/sell events
    else if (msg.type == "startIntersection") {
        // log start information
        let symbols = msg.partition;
        const start = Date.now();
        let startTicker = symbols[0];
        let endTicker = symbols[symbols.length - 1];
        fs.appendFileSync(logDirectory + `\\intersectionLogs.txt`,
            `Worker ${msg.id}: Finding intersections for tickers ${startTicker} to ${endTicker}\n`, { encoding: "utf-8" });

        // conduct actual intersection finding
        let intersections = {};
        for (let i = 0; i < symbols.length; ++i) {
            let symbol = symbols[i];

            // find results for the symbol
            let intersection = await findIntersections(msg.strategyOptions, symbol);
            // only record if if has buy/sell events
            if (intersection["events"].length > 0) {
                intersections[symbol] = intersection;
            }
            console.log(`${symbol} => ${intersection["events"].length}`);
        }
        // notify parent
        process.send({ status: "finished", intersections });


        // log end information
        let time = Math.floor((Date.now() - start) / 1000);
        fs.appendFileSync(logDirectory + `\\intersectionLogs.txt`, `Worker ${msg.id}: Finished backtest for tickers ${startTicker} to ${endTicker} in ${time} seconds\n`, { encoding: "utf-8" });
        process.exit(0);
    }
    // thread to run updates
    else if (msg.type == "startUpdate") {
        // log start information
        let today = new Date();
        let documents = msg.partition;
        const start = Date.now();
        let startTicker = documents[0]._id;
        let endTicker = documents[documents.length - 1]._id;
        fs.appendFileSync(logDirectory + `\\updateLogs.txt`,
            `Worker ${msg.updateID}: Starting update for tickers ${startTicker} to ${endTicker}\n`, { encoding: "utf-8" })

        // start actual updates
        for (let i = 0; i < documents.length; ++i) {
            let document = documents[i];
            // update the stock
            await updateStock(document, today);
        }

        // log end information
        let time = Math.floor((Date.now() - start) / 1000);
        fs.appendFileSync(logDirectory + `\\updateLogs.txt`,
            `Worker ${msg.updateID}: Finished update for tickers ${startTicker} to ${endTicker} in ${time} seconds\n`, { encoding: "utf-8" })
        process.exit(0);
    }
});