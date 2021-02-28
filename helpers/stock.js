var yahooFinance = require('yahoo-finance');
var path = require('path');
var fs = require('fs');
const { fork } = require('child_process');

var { updateStockInfo, getDocument, getCollection, setStockInfo } = require("./mongo");
let { formatDate, daysBetween, hoursBetween, clampRange, shallowEqual, makeid } = require('./utils');
let { getIndicator } = require('./backtest');
let { addJob } = require('../helpers/queue');
let { getYahooBars } = require('./yahoo');
const { getAlpacaBars } = require('./alpaca');

let PATH_TO_FAULTY = path.join(__dirname, "../res/faulty.json");
let PATH_TO_BLACKLIST = path.join(__dirname, "../res/blacklist.json");

// get latest price of a stock
async function getLatestPrice(symbol) {
    let priceCollection = await getCollection("prices" + "day");
    let stockInfo = await priceCollection.find({ _id: symbol }).project({ prices: { $slice: -1 } });
    stockInfo = await stockInfo.toArray();
    if (stockInfo.length > 0) {
        return stockInfo[0]["prices"][0];
    }
    else {
        return {};
    }
}

// Get price from own database
function getPrices(symbol, timeframe) {
    return new Promise(async (resolve, reject) => {
        getDocument("prices" + timeframe, symbol)
            .then(document => {
                resolve(document.prices);
            })
            .catch(err => reject(err));
    });
}

// queues job to update stock prices
async function update(timeframe) {
    addJob(() => {
        return new Promise(async resolveJob => {
            // get all docs from mongo
            console.log("Retreiving symbols!");
            let priceCollection = await getCollection("prices" + timeframe);
            let stockInfo = await priceCollection.find({}).project({ _id: 1, lastUpdated: 1, prices: { $slice: -1 } })//.limit(10);
            stockInfo = await stockInfo.toArray();
            console.log(`Retreived ${stockInfo.length} symbols!`);

            // create id to identify the update in logs
            let updateID = makeid(5);

            // create threads that split up the work
            let partitionSize = Math.ceil(stockInfo.length / process.env.NUM_THREADS);
            let finishedWorkers = 0;
            for (let i = 0; i < process.env.NUM_THREADS; ++i) {
                // divy up the documents for each thread to work on
                let partition = stockInfo.slice(i * partitionSize, (i + 1) * partitionSize);

                // spawn child to do work
                let child = fork(path.join(__dirname, "../helpers/worker.js"));
                child.send({ type: "startUpdate", partition, updateID, timeframe });
                child.on('message', function (message) {
                    if (message.status == "finished") {
                        if (++finishedWorkers == process.env.NUM_THREADS) {
                            console.log("Symbol Update Complete");
                            resolveJob();
                        }
                    }
                });
            }
        })
    }, true)
}

// update a price document if needed
function updateStocks(doc, updateDate, timeframe) {
    return new Promise(async (resolve, reject) => {
        // get information from document
        let symbol = doc["_id"];
        let priceData = undefined;

        // try to get price data
        try {
            // get last recorded date
            let baseDate = "1/1/1500";
            let startDate = new Date(baseDate);
            if (doc["prices"].length > 0) {
                startDate = new Date(doc["prices"][0]["date"])
            }

            priceData = await getUpdatedPrices(doc["_id"], startDate, updateDate, timeframe);

            // update database
            console.log(`${symbol} update size: ${priceData.length}`);
            await updateStockInfo(doc["_id"], priceData, updateDate, timeframe);
        } catch (e) {
            console.log("Error! ", e);
        }

        resolve();
    });
}

// Get price from external api
function getUpdatedPrices(symbol, startDate, endDate, timeframe) {
    console.log(symbol, "update range:", startDate, "=>", endDate);
    return new Promise((resolve, reject) => {
        // update on same day
        if (endDate < startDate) {
            return resolve([]);
        }
        try {
            let vendor = undefined;
            if (timeframe == "day") vendor = getYahooBars;
            else vendor = getAlpacaBars;
            vendor(symbol, startDate, endDate, timeframe)
                .then(bars => {
                    for (let i = 0; i < bars.length; ++i) {
                        // remove updates that are out of range 
                        if (bars[i]["date"] <= startDate) {
                            bars.shift();
                            --i;
                        }
                        else {
                            break;
                        }
                    }
                    // check last 3 results for repeats
                    let baseDate = "1/1/1500";
                    let previousDate = new Date(baseDate);
                    for (let i = Math.max(0, bars.length - 3); i < bars.length; ++i) {
                        if (bars[i]["date"].getTime() == previousDate.getTime()) {
                            bars.splice(i - 1, 1);
                            --i;
                        }
                        previousDate = bars[i]["date"];
                    }
                    resolve(bars);
                })
        } catch (e) {
            reject(`Error: ${e}`);
        }
    });
}

// queues job to check splits
async function checkSplit() {
    console.log("Checking for Splits");
    addJob(() => {
        return new Promise(async resolveJob => {
            let priceCollection = await getCollection("prices" + "day");
            // check all stocks for their beginning price
            let stockInfo = await priceCollection.find({}).project({ _id: 1, prices: { $slice: 1 } });
            stockInfo = await stockInfo.toArray();

            // create id to identify the job in logs
            let jobID = makeid(5);

            // create threads that split up the work
            let partitionSize = Math.ceil(stockInfo.length / process.env.NUM_THREADS);
            let finishedWorkers = 0;
            let totalChanges = 0;
            for (let i = 0; i < process.env.NUM_THREADS; ++i) {
                // divy up the documents for each thread to work on
                let partition = stockInfo.slice(i * partitionSize, (i + 1) * partitionSize);

                // spawn child to do work
                let child = fork(path.join(__dirname, "../helpers/worker.js"));
                child.send({ type: "startSplitCheck", partition, jobID });
                child.on('message', function (message) {
                    if (message.status == "finished") {
                        totalChanges += message.changes;
                        if (++finishedWorkers == process.env.NUM_THREADS) {
                            console.log("Symbol Split Check Complete With", totalChanges, "Changes!");
                            resolveJob();
                        }
                    }
                });
            }
        })
    });
}

// rewrite a document in the case of a stock split
async function checkSplitForSymbol(doc) {
    let today = new Date();
    let baseDate = new Date("1/1/1500");

    // get symbol and first entry
    let symbol = doc["_id"];
    let entry = doc["prices"][0];

    // empty stock
    if (!entry) {
        return 0;
    }

    // get the date to search up API
    let recordedDate = new Date(entry["date"]);
    recordedDate.setDate(recordedDate.getDate() + 1);
    let previousDate = new Date(recordedDate);
    previousDate.setDate(previousDate.getDate() - 2);

    // search up api
    let updatedEntry = await getUpdatedPrices(symbol, previousDate, recordedDate, "day");
    updatedEntry = updatedEntry[0];
    if (!updatedEntry) {
        return 0;
    }

    // check if valid
    let valid = new Date(entry["date"]).getTime() == new Date(updatedEntry["date"]).getTime();
    if (!valid) {
        return 0;
    }

    delete entry["date"];
    delete updatedEntry["date"];
    valid = valid && shallowEqual(entry, updatedEntry);
    if (!valid) {
        resetSymbol(symbol, baseDate, today);
        return 1;
    }
    return 0;
}

// reset the data for a symbol
async function resetSymbol(symbol, baseDate, today) {
    let updatedEntry = await getUpdatedPrices(symbol, baseDate, today, "day");
    // update mongo document
    await setStockInfo(symbol, updatedEntry, today, "day");
}

// fix faulty data
async function fixFaulty() {
    let results = { "fixed": 0, "blacklisted": 0 };
    if (fs.existsSync(PATH_TO_FAULTY)) {
        let faulty = JSON.parse(fs.readFileSync(PATH_TO_FAULTY, { encoding: "utf-8" }));
        let blacklist = JSON.parse(fs.readFileSync(PATH_TO_BLACKLIST, { encoding: "utf-8" }));
        let today = new Date();
        let baseDate = new Date("1/1/1500");

        // go through faulty list
        for (let i = 0; i < faulty.length; ++i) {
            let symbol = faulty[i];
            // fix the data
            await resetSymbol(symbol, baseDate, today);

            // check if fixed
            let symbolData = (await getDocument("prices" + "day", symbol))["prices"];
            let fixed = true;
            for (let j = 0; j < symbolData.length; ++j) {
                // not fixed, add to blacklist
                if (!symbolData[j]["close"]) {
                    blacklist.push(symbol);
                    fixed = false;
                    break;
                }
            }

            // tally stats
            if (fixed) {
                results["fixed"] += 1;
            }
            else {
                results["blacklisted"] += 1;
            }
        }

        // by the end, symbols should be fixed or blacklisted
        fs.writeFileSync(PATH_TO_FAULTY, "[]", { encoding: "utf-8" });
        fs.writeFileSync(PATH_TO_BLACKLIST, JSON.stringify(blacklist), { encoding: "utf-8" });
    }
    return results;
}

module.exports = { update, updateStocks, getPrices, getUpdatedPrices, getLatestPrice, checkSplit, checkSplitForSymbol, resetSymbol, fixFaulty }