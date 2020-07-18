var express = require('express');
var router = express.Router();
let fetch = require('node-fetch');
var path = require('path');
var fs = require('fs');
var vendor = require('../helpers/vendor');
const csv = require('csv');

// paths to resources
let PATH_TO_METADATA = path.join(__dirname, '../res/metadata.json');
let PATH_TO_OLD_RESULTS = path.join(__dirname, '../res/results.json');
let PATH_TO_RESULTS = path.join(__dirname, '../res/results15_50.json');
let PATH_TO_SYMBOLS = path.join(__dirname, "../res/symbols.json");
let PATH_TO_CSV = path.join(__dirname, "../res/supported_tickers.csv");
let PATH_TO_CACHE = path.join(__dirname, "../res/priceCache.json");
let PATH_TO_KEY_CACHE = path.join(__dirname, "../res/symbolToKey.json");

// cache settings
// Symbol/Price/Key
const useCache = true;

// how many intersections to report
const INTERSECTION_SIZE = 10;
// base api url
const BASE_URL = "https://api.tiingo.com/tiingo/daily";
// minimum volume to consider
const MIN_VOLUME = 1000000;
let SMA_INTERVALS = [15, 50];
let RSI_INTERVAL = 14;
let EXCHANGES = ["AMEX", "NASDAQ", "NYSE"];
// get results within expiration date
let EXPIRATION = 1000000;
// get prices from today - START_DATE
let START_DATE = 365 * 10;

// Globals
// use offset to query in chunks
let offset = 0;
// only read/write priceCache once a big update
let priceCache = {};
let keyCache = {};

router.get("/metadata", (req, res) => {
    res.json(JSON.parse(fs.readFileSync(PATH_TO_METADATA, { encoding: "utf-8" })));
})

router.get("/results", (req, res) => {
    res.json(JSON.parse(fs.readFileSync(PATH_TO_RESULTS, { encoding: "utf-8" })));
})

// gets basic information from a symbol
function getInfo(symbol, callback) {
    fetch(BASE_URL + `/${symbol}`, {
        method: 'get',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Token ${vendor.getKey(0, 0)}`
        },
    })
        .then(res => res.text())
        .then(json => {
            callback(json);
        });
}

// gets the intersection for one company
router.get("/intersection", async (req, res) => {
    let symbol = req.query["symbol"];
    try {
        let attempts = 0;
        while (true) {
            try {
                console.log("TRYING AGAIN")
                let intersection = await findIntersections(symbol, 0, attempts);
                res.json(intersection);
                break;
            } catch (e) {
                attempts++;
                console.log("Error: " + e);
                if (typeof e == "string" && e.includes("not found")) {
                    console.log("TICKER ERROR!");
                    error = true;
                    break;
                }
                // if all keys fail
                if (attempts >= vendor.numKeys()) {
                    console.log("MAX KEY FAILURE!");
                    fail = true;
                    break;
                }
            }
        }
    } catch (e) {
        res.send(e);
    }
})

// gets the intersection for all companies
router.get("/intersections", (req, res) => {
    console.log("Loading metadata...");
    let metadata = JSON.parse(fs.readFileSync(PATH_TO_METADATA, { encoding: "utf-8" }));
    let today = new Date();
    let lastUpdate = new Date(metadata["lastUpdate"]);
    let daysDifference = daysBetween(lastUpdate, today);

    // only update once a day
    if (daysDifference < 0) { // < 1 for production
        console.log("Update Rejected!");
        res.json({ "status": "Already Updated!" });
    }
    // clear for update
    else {
        console.log("Update Accepted!");
        // update update time
        metadata["lastUpdate"] = today;
        console.log("Updating metadata...");
        fs.writeFileSync(PATH_TO_METADATA, JSON.stringify(metadata), "utf8");

        // use offset if provided
        offset = req.query["offset"] ? parseInt(req.query["offset"]) : offset;

        // if price cache doesnt exist
        if (!fs.existsSync(PATH_TO_CACHE)) {
            // create an empty cache
            console.log("Creating Price Cache...");
            fs.writeFileSync(PATH_TO_CACHE, "{}");
        }
        // load price cache
        console.log("Loading Price Cache...");
        priceCache = JSON.parse(fs.readFileSync(PATH_TO_CACHE, { encoding: "utf-8" }));

        // if key cache doesnt exist
        if (!fs.existsSync(PATH_TO_KEY_CACHE)) {
            // create an empty cache
            console.log("Creating Key Cache...");
            fs.writeFileSync(PATH_TO_KEY_CACHE, "{}");
        }
        // load key cache
        console.log("Loading Key Cache...");
        keyCache = JSON.parse(fs.readFileSync(PATH_TO_KEY_CACHE, { encoding: "utf-8" }));

        // get list of symbols to query
        getConfirmedSymbols(async (symbols) => {
            console.log(symbols);
            // send response so doesn't hang
            res.json({ "status": "Updating!" });

            // maps symbol to list of intersecting dates
            let intersections = {};
            let max = Math.min(offset + 100000, symbols.length);

            // go through each symbol
            for (i = offset; i < max; ++i) {
                console.log(`\nStock ${i + 1} of ${max}`);
                let symbol = symbols[i];
                let attempts = 0;
                let fail = false;

                // keep trying until valid key
                while (true) {
                    try {
                        let intersection = await findIntersections(symbol, i, attempts);
                        // only record if if has intersection
                        if (intersection["events"].length > 0) {
                            intersections[symbol] = intersection;
                        }
                        // console.log(`${symbol} => ${JSON.stringify(intersection)}`);
                        break;
                    } catch (e) {
                        // if something went wrong, keep trying with new key
                        attempts++;
                        console.log(e);
                        if (e.includes("not found")) {
                            console.log("TICKER ERROR!");
                            fail = true;
                            break;
                        }
                        // if all keys fail
                        if (attempts >= vendor.numKeys()) {
                            console.log("MAX KEY FAILURE!");
                            fail = true;
                            break;
                        }
                    }
                }
                if (fail) continue;
            }

            // store back priceCache
            console.log("\nUpdating Price Cache...");
            // fs.writeFileSync(PATH_TO_CACHE, JSON.stringify(priceCache), { encoding: "utf-8" })
            console.log("Price Cache Size: ", Object.keys(priceCache).length);

            // store back keyCache
            console.log("\nUpdating Key Cache...");
            fs.writeFileSync(PATH_TO_KEY_CACHE, JSON.stringify(keyCache), { encoding: "utf-8" })
            console.log("Key Cache Size: ", Object.keys(keyCache).length);

            // merge results with existing results
            let existing = {};
            if (fs.existsSync(PATH_TO_RESULTS)) {
                console.log("\nLoading Existing Results...");
                existing = JSON.parse(fs.readFileSync(PATH_TO_RESULTS, { encoding: "utf-8" }));
                console.log("Existing Results Size: ", Object.keys(existing).length);
            }
            Object.assign(existing, intersections);

            // write results to file
            console.log("\nUpdating Results...");
            fs.writeFileSync(PATH_TO_RESULTS, JSON.stringify(existing), "utf8");
            console.log("Results Size: ", Object.keys(existing).length);
            console.log(`Results stored into '${PATH_TO_RESULTS}'!`);

            // update offset
            offset = max;
            // reset offset to 0
            if (offset == symbols.length) {
                offset = 0;
            }
            console.log("\nNEW OFFSET: ", offset);
        });
    }
})

// gets the symbols from cache or from csv
function getSymbols(callback) {
    // read from cache
    if (fs.existsSync(PATH_TO_SYMBOLS) && useCache) {
        console.log("Loading Symbols from Cache...");
        let symbols = JSON.parse(fs.readFileSync(PATH_TO_SYMBOLS, { encoding: "utf-8" }));
        callback(symbols);
    }
    // parse info from csv
    else {
        console.log("Loading Symbols from CSV...");
        // read csv
        let data = fs.readFileSync(PATH_TO_CSV, { encoding: "utf-8" });
        let symbols = [];

        // parse data
        csv.parse(data, {
            comment: '#'
        }, function (err, output) {
            let today = new Date(Date.now());
            // ticker, exchange, assetType, priceCurrency, startDate, endDate
            let labels = output.shift();

            // filter out unwanted stocks
            output.forEach(stock => {
                let d = new Date(stock[5]);
                // US exchanges only, stock only, updated within this year
                if (EXCHANGES.includes(stock[1]) && stock[2] == "Stock" && stock[3] == "USD" && stock[5] && d.getFullYear() == today.getFullYear()) {
                    symbols.push(stock[0]);
                }
            })

            // cache for next use
            console.log("Caching Symbols!");
            fs.writeFile(PATH_TO_SYMBOLS, JSON.stringify(symbols), "utf8", (err) => { if (err) throw err; });
            callback(symbols);
        })
    }
}

// get symbols from results
function getConfirmedSymbols(callback) {
    // update existing results
    console.log("Loading Symbols from Old Results...");
    let symbols = JSON.parse(fs.readFileSync(PATH_TO_OLD_RESULTS, { encoding: "utf-8" }));
    callback(Object.keys(symbols));
}

// given symbol, find intersections
// index and attempts used to find appropriate key
function findIntersections(symbol, index, attempts) {
    // get a suitable key
    let key;
    if (keyCache[symbol] && attempts == 0 && useCache) {
        key = keyCache[symbol];
    }
    else {
        key = vendor.getKey(index, attempts);
    }

    return new Promise((resolve, reject) => {
        // find prices
        getPrices(symbol, key, (json) => {
            // if error
            if (json["error"]) {
                reject(json["error"]);
            }
            // if valid prices
            else {
                // save working key
                keyCache[symbol] = key;

                // maps date to closing price
                let prices = {};
                json.forEach(day => {
                    prices[day["date"]] = day["close"];
                });

                // sort dates
                let dates = Object.keys(prices).sort(function (a, b) {
                    return new Date(a) - new Date(b);
                });

                // calculate curves
                let smaCurves = [];
                SMA_INTERVALS.forEach(interval => smaCurves.push(getSimpleMovingAverage(dates, prices, interval)));
                let macd = getMACD(dates, prices);
                let rsi = getRSI(dates, prices);

                // make sure all curves are valid
                let valid = true;
                for (let i = 0; i < smaCurves.length - 1; ++i) {
                    if (!smaCurves[i]["valid"]) {
                        valid = false;
                    }
                }
                if (!macd["valid"] || !rsi["valid"]) {
                    valid = false;
                }

                if (valid) {
                    // find list of intersections using curves
                    let goldenCrosses = getGoldenCrosses(dates, smaCurves, macd);
                    let deathCrosses = getDeathCrosses(dates, smaCurves);

                    // filter for volume
                    let goldenFiltered = [];
                    json.forEach(day => {
                        // if golden cross day
                        if (goldenCrosses.includes(day["date"]) && day["volume"] > MIN_VOLUME) {
                            // add info
                            goldenFiltered.push({ goldenDate: day["date"], volume: day["volume"] });
                        }
                    });

                    // pair golden crosses with nearest death cross
                    let events = pairCrosses(goldenFiltered, deathCrosses);
                    // add information to each event
                    events.forEach(event => {
                        let gd = event["goldenDate"];
                        let dd = event["deathDate"]
                        event["goldenPrice"] = prices[gd];
                        event["deathProfit"] = prices[dd] - prices[gd];
                        let sellByRSI = false;
                        let sellByMACD = false;
                        let minMACD = 0;
                        for(let i = dates.indexOf(gd) + 1; i < dates.length - 1; ++i){
                            let day = dates[i];
                            let yesterday = dates[i - 1];
                            if (macd["data"][day] < minMACD) {
                                minMACD = macd["data"][day];
                            }
                            if (((rsi["data"][day] < 70 && rsi["data"][yesterday] > 70) || macd["data"][day] < -11) && !sellByRSI) {
                                if (macd["data"][day] < -18) {
                                    console.log(macd["data"][day]);
                                }
                                sellByRSI = true;
                                event["rsiDate"] = day;
                                event["rsiProfit"] = prices[day] - prices[gd];
                                event["rsiMinMACD"] = minMACD;
                            }
                            if (macd["data"][day] < 0 && !sellByMACD) {
                                sellByMACD = true;
                                event["macdDate"] = day;
                                event["macdProfit"] = prices[day] - prices[gd];
                            }
                        }
                        // event["goldenMACD"] = macd["data"][gd];
                        // event["deathMACD"] = macd["data"][dd];
                        // event["goldenRSI"] = rsi["data"][gd];
                        // event["deathRSI"] = rsi["data"][dd];
                    })

                    // get last few elements only
                    // events = events.slice(Math.max(events.length - INTERSECTION_SIZE, 0))
                    resolve({ events: events, goldenCrosses: goldenCrosses, deathCrosses: deathCrosses });
                } else {
                    resolve({ events: [], goldenCrosses: [], deathCrosses: [] });
                }
            }
        });
    })
}

// makes api call to get historic prices
function getPrices(symbol, key, callback) {
    // try using cache
    if (useCache) {
        // cache hit
        if (priceCache[symbol]) {
            callback(priceCache[symbol]);
            return;
        }
    }

    // get start date
    let startDate = new Date();
    startDate.setDate(startDate.getDate() - START_DATE);

    // fetch price data from API
    fetch(BASE_URL + `/${symbol}/prices?startDate=${formatDate(startDate)}`, {
        method: 'get',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Token ${key}`
        },
    })
        .then(res => res.text())
        .then(text => {
            // parse text to catch errors
            try {
                res = JSON.parse(text)
                // if failed
                if (res["detail"]) {
                    res["error"] = res["detail"];
                }
                else {
                    priceCache[symbol] = res;
                }
                callback(res);
            }
            // parsing error
            catch (e) {
                callback({ "error": text })
            }
        })
        // API error
        .catch(err => { callback({ "error": err }) });
}

// gets a list of points (date, price) for simple moving average
function getSimpleMovingAverage(dates, prices, interval) {
    let res = {};
    let sum = 0;
    let start = undefined;
    // go through each date
    for (let i = 0; i < dates.length; ++i) {
        let day = dates[i];
        // if not enough for moving sum, keep adding
        if (i < interval) {
            sum += prices[day];
            if (i == interval - 1) {
                res[day] = sum / interval;
                start = day;
            }
        }
        // start saving moving sum
        else {
            sum += prices[day] - prices[dates[i - interval]];
            res[day] = sum / interval;
        }
    }
    return { valid: start != undefined, start: start, data: res };
}

function getMACD(dates, prices) {
    let res = {};
    // get exponential averages
    twelve = getExponentialMovingAverage(dates, prices, 12);
    twentySix = getExponentialMovingAverage(dates, prices, 26);

    // if both valid
    if (twelve["valid"] && twentySix["valid"]) {
        // start storing the differences
        let startIndex = dates.indexOf(twentySix["start"]);
        for (let i = startIndex; i < dates.length - 1; ++i) {
            let day = dates[i];
            res[day] = twelve["data"][day] - twentySix["data"][day];
        }
    }
    else {
        return { valid: false, start: undefined, data: res };
    }
    return { valid: true, start: twentySix["start"], data: res };
}

// gets a list of points (date, price) for exponential moving average
function getExponentialMovingAverage(dates, prices, interval) {
    let res = {};
    let sum = 0;
    let start = undefined;
    let last = 0;
    let multiplier = 2.0 / (interval + 1);
    // go through each date
    for (let i = 0; i < dates.length; ++i) {
        let day = dates[i];
        // if not enough for moving sum, keep adding
        if (i < interval) {
            sum += prices[day];
        }
        // start saving moving sum
        else {
            if (i == interval) {
                start = day;
                // last is the SMA
                last = sum / interval;
            }
            res[day] = prices[day] * multiplier + last * (1 - multiplier);
            last = res[day];
        }
    }
    return { valid: start != undefined, start: start, data: res };
}

function getRSI(dates, prices) {
    let res = {};
    // get wilder averages
    let avgU = getWilderSmoothing(dates, prices, true);
    let avgD = getWilderSmoothing(dates, prices, false);

    // if both valid
    if (avgU["valid"] && avgD["valid"]) {
        // start storing the RSI
        let startIndex = dates.indexOf(avgU["start"]);
        for (let i = startIndex; i < dates.length; ++i) {
            let day = dates[i];
            let rs = avgU["data"][day] / avgD["data"][day];
            res[day] = 100 - (100 / (1 + rs));
        }
    } else {
        return { valid: false, start: undefined, data: res };
    }
    return { valid: true, start: avgU["start"], data: res };

}

// gets a list of points (date, price) for Wilder's smoothing average
function getWilderSmoothing(dates, prices, up) {
    let res = {};
    let sum = 0;
    let start = undefined;
    let avg = 0;
    // go through each date
    for (let i = 1; i < dates.length; ++i) {
        let yesterday = dates[i - 1];
        let day = dates[i];
        let ut = prices[day] - prices[yesterday];
        let dt = prices[yesterday] - prices[day];
        ut = ut > 0 ? ut : 0;
        dt = dt > 0 ? dt : 0;
        // if not enough for moving sum, keep adding
        if (i < RSI_INTERVAL) {
            if (up) {
                sum += ut;
            }
            else {
                sum += dt;
            }
        }
        // start saving moving sum
        else {
            if (i == RSI_INTERVAL) {
                start = day;
                avg = sum / RSI_INTERVAL;
            }
            if (up) {
                avg = avg * ((RSI_INTERVAL - 1) / RSI_INTERVAL) + ut * (1 / RSI_INTERVAL);
            }
            else {
                avg = avg * ((RSI_INTERVAL - 1) / RSI_INTERVAL) + dt * (1 / RSI_INTERVAL);
            }
            res[day] = avg;
        }
    }
    return { valid: start != undefined, start: start, data: res };
}

// curve(k-1) has smaller interval than curve(k)
function getGoldenCrosses(dates, curves, macd) {
    // calculate valid date
    let today = new Date();
    let lastDate = new Date();
    lastDate.setDate(today.getDate() - EXPIRATION);
    let res = [];

    // start index is last curve's start date
    let startIndex = Math.max(dates.indexOf(curves[curves.length - 1]["start"]), dates.indexOf(macd["start"]));
    // look through all dates
    for (let i = startIndex; i < dates.length - 1; ++i) {
        let day = dates[i];
        let nextDay = dates[i + 1];
        let valid = true;

        // look through all curves
        for (let c = 0; c < curves.length - 1; c++) {
            let curve1 = curves[c];
            let curve2 = curves[c + 1];
            if (!isCrossed(curve1["data"][day], curve1["data"][nextDay], curve2["data"][day], curve2["data"][nextDay], true)) {
                valid = false;
                break;
            }
        }

        // if golden cross and date is valid and macd > 0
        if (valid && new Date(day) > lastDate) {
            if (macd["data"][day] > 0) {
                res.push(day);
            }
        }
    }

    return res;
}

function getDeathCrosses(dates, curves) {
    // calculate valid date
    let today = new Date();
    let lastDate = new Date();
    lastDate.setDate(today.getDate() - EXPIRATION);
    let res = [];

    // start index is last curve's start date
    let startIndex = dates.indexOf(curves[curves.length - 1]["start"]);
    // look through all dates
    for (let i = startIndex; i < dates.length - 1; ++i) {
        let day = dates[i];
        let nextDay = dates[i + 1];
        let valid = true;
        // look through all curves
        for (let c = 0; c < curves.length - 1; c++) {
            let curve1 = curves[c];
            let curve2 = curves[c + 1];
            if (!isCrossed(curve1["data"][day], curve1["data"][nextDay], curve2["data"][day], curve2["data"][nextDay], false)) {
                valid = false;
                break;
            }
        }
        // if golden cross and date is valid and macd > 0
        if (valid && new Date(day) > lastDate) {
            res.push(day);
        }
    }

    return res;
}

function pairCrosses(golden, death) {
    death = [...death];
    let pairs = []
    // for each golden day
    golden.forEach(goldenDay => {
        // find closest death day after 
        while (death.length > 0 && new Date(death[0]) < new Date(goldenDay["goldenDate"])) {
            death.shift();
        }
        // add pair if exists
        if (death.length > 0) {
            goldenDay["deathDate"] = death.shift();
            pairs.push(goldenDay);
        }
    });
    return pairs;
}

// determine if line (x1, a1) => (x2, a2) crosses line (x1, b1) => (x2, b2)
function isCrossed(a1, a2, b1, b2, crossUp) {
    if (crossUp) {
        // smaller interval has to start below or equal to greater interval
        if (a1 <= b1) {
            // smaller interval has to end above to greater interval
            return a2 > b2;
        } else {
            return false;
        }
    }
    else {
        // smaller interval has to start above or equal to greater interval
        if (a1 >= b1) {
            // smaller interval has to end below to greater interval
            return a2 < b2;
        } else {
            return false;
        }
    }

}

// format date to api needs
function formatDate(date) {
    var d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2)
        month = '0' + month;
    if (day.length < 2)
        day = '0' + day;

    return [year, month, day].join('-');
}

function daysBetween(date1, date2) {
    // The number of milliseconds in one day
    const ONE_DAY = 1000 * 60 * 60 * 24;
    // Calculate the difference in milliseconds
    const differenceMs = Math.abs(date1 - date2);
    // Convert back to days and return
    return Math.round(differenceMs / ONE_DAY);
}

module.exports = router;