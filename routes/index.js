var express = require('express');
var router = express.Router();
let fetch = require('node-fetch');
var path = require('path');
var fs = require('fs');
var vendor = require('../helpers/vendor');
const csv = require('csv');

let PATH_TO_METADATA = path.join(__dirname, '../helpers/metadata.json');
let PATH_TO_RESULTS = path.join(__dirname, 'results.json');
let PATH_TO_SYMBOLS = path.join(__dirname, "symbols.json");
let PATH_TO_CSV = path.join(__dirname, "supported_tickers.csv");
const INTERSECTION_SIZE = 1;
const BASE_URL = "https://api.tiingo.com/tiingo/daily";
const MIN_VOLUME = 1000000;
let INTERVALS = [5, 20];
let EXCHANGES = ["AMEX", "NASDAQ", "NYSE"];
let EXPIRATION = 7;

let offset = 0;

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
      'Authorization': `Token ${vendor.getKey()}`
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
    let intersections = await findIntersections(symbol);
    res.json(intersections);
  }
  catch (e) {
    res.send(e);
  }
})

// gets the intersection for all companies
router.get("/intersections", (req, res) => {
  let metadata = JSON.parse(fs.readFileSync(PATH_TO_METADATA, { encoding: "utf-8" }));
  let today = new Date();
  let lastUpdate = new Date(metadata["lastUpdate"]);
  let daysDifference = daysBetween(lastUpdate, today);
  console.log(daysDifference)
  if (daysDifference < 1) {
    res.json({ "status": "Already Updated!" });
  }
  else {
    offset = req.query["offset"] ? parseInt(req.query["offset"]) : offset;
    getSymbols(async (symbols) => {
      // update data
      res.json({"status": "Updating!"});
      metadata["lastUpdate"] = today;
      fs.writeFile(PATH_TO_METADATA, JSON.stringify(metadata), "utf8", (err) => { if (err) throw err; });
      // maps symbol to list of intersecting dates
      let intersections = {};
      let max = Math.min(offset + 10000, symbols.length);
      for (i = offset; i < max; ++i) {
        console.log(`Stock ${i} of ${max}`);
        let symbol = symbols[i];
        let attempts = 0;
        let fail = false;
        let error = false;
        // keep trying until valid key
        while (true) {
          try {
            let intersection = await findIntersections(symbol);
            // only record if if has intersection
            if (intersection.length > 0) {
              intersections[symbol] = intersection;
            }
            console.log(`${symbol} => ${intersection}`);
            break;
          }
          catch (e) {
            attempts++;
            console.log(e);
            if (e.includes("not found")) {
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
        if (fail) break;
        if (error) continue;
      }
      // merge results with existing results
      let existing = {};
      if (fs.existsSync(PATH_TO_RESULTS)) {
        existing = JSON.parse(fs.readFileSync(PATH_TO_RESULTS, { encoding: "utf-8" }));
      }
      Object.assign(existing, intersections);
      // write results to file
      fs.writeFile(PATH_TO_RESULTS, JSON.stringify(existing), "utf8", (err) => { if (err) throw err; });
      // update offset
      offset = max;
      // reset offset to 0
      if (offset == symbols.length) {
        offset = 0;
      }
      console.log("NEW OFFSET: ", offset);
    }, false);
  }
})

// gets the symbols from cache or from csv
function getSymbols(callback, clearCache) {
  if (fs.existsSync(PATH_TO_SYMBOLS) && !clearCache) {
    console.log("Using Symbols Cache!");
    let symbols = JSON.parse(fs.readFileSync(PATH_TO_SYMBOLS, { encoding: "utf-8" }));
    callback(symbols);
  }
  else {
    // read csv
    let data = fs.readFileSync(PATH_TO_CSV, { encoding: "utf-8" });
    let symbols = [];
    // parse data
    csv.parse(data, {
      comment: '#'
    }, function (err, output) {
      // filter out unwanted stocks
      let today = new Date(Date.now());
      let labels = output.shift();
      output.forEach(stock => {
        let d = new Date(stock[5]);
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

// makes api call to get historic prices
function getPrices(symbol, key, callback) {
  // have start date be a year from today
  var d = new Date();
  d.setDate(d.getDate() - 365);
  // fetch data from API
  fetch(BASE_URL + `/${symbol}/prices?startDate=${formatDate(d)}`, {
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
        callback(JSON.parse(text));
      }
      // use detail to signal error
      catch (e) {
        callback({ "detail": text })
      }
    })
    .catch(err => { callback({ "detail": err }) });
}

function findIntersections(symbol) {
  console.log("FINDING INTERSECTION FOR ", symbol);
  let key = vendor.getKey();
  return new Promise((resolve, reject) => {
    // find prices
    getPrices(symbol, key, (json) => {
      // if error
      if (json["detail"]) {
        // vendor.removeKey(key);
        reject(json["detail"]);
      }
      else {
        let prices = {};
        // maps day to closing price
        json.forEach(day => {
          prices[day["date"]] = day["close"];
        });
        // sort dates
        let dates = Object.keys(prices).sort(function (a, b) {
          return new Date(a) - new Date(b);
        });
        // calculate curves
        let curves = [];
        INTERVALS.forEach(interval => curves.push(getMovingAverage(dates, prices, interval)));
        // find list of intersections
        let intersections = getIntersections(dates, curves);
        // filter for volume
        let filtered = [];
        json.forEach(day => {
          if (intersections.includes(day["date"]) && day["volume"] > MIN_VOLUME)
            filtered.push(day["date"]);
        });
        // get last few elements only
        intersections = filtered.slice(Math.max(filtered.length - INTERSECTION_SIZE, 0))
        resolve(intersections);
      }
    });
  })
}

// gets a list of points (date, price) for moving average
function getMovingAverage(dates, prices, interval) {
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

// curve(k-1) has smaller interval than curve(k)
function getIntersections(dates, curves) {
  // calculate valid date
  let today = new Date();
  let lastDate = new Date();
  lastDate.setDate(today.getDate() - EXPIRATION);
  let res = [];
  // make sure all curves are valid
  for (let i = 0; i < curves.length - 1; ++i) {
    if (!curves[i]["valid"]) {
      return res;
    }
  }
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
      if (!isCrossed(curve1["data"][day], curve1["data"][nextDay], curve2["data"][day], curve2["data"][nextDay])) {
        valid = false;
        break;
      }
    }
    // if golden cross and date is valid
    if (valid && new Date(day) > lastDate) {
      res.push(day);
    }
  }

  return res;
}

// determine if line (x1, a1) => (x2, a2) crosses line (x1, b1) => (x2, b2)
function isCrossed(a1, a2, b1, b2) {
  // smaller interval has to start below or equal to greater interval
  if (a1 <= b1) {
    // smaller interval has to end above to greater interval
    return a2 > b2;
  }
  else {
    return false;
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
