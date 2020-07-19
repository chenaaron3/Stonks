var express = require('express');
var router = express.Router();

let SMA = require('../helpers/sma');
let RSI = require('../helpers/rsi');
let MACD = require('../helpers/macd');
var path = require('path');
var fs = require('fs');
let PATH_TO_CACHE = path.join(__dirname, "../res/priceCache.json");

/* GET users listing. */
router.get('/', function(req, res, next) {
	let priceCache = JSON.parse(fs.readFileSync(PATH_TO_CACHE, { encoding: "utf-8" }));
	let prices = {};
	let symbol = "A";
	let interval = 10;

    priceCache[symbol].forEach(day => {
        prices[day["date"]] = day["close"];
    });

    let dates = Object.keys(prices).sort(function (a, b) {
        return new Date(a) - new Date(b);
    });

	// let sma = new SMA(symbol, dates, prices);
	// sma.initialize(interval);
	// console.log(sma.graph);

	// console.log(sma.getAction("2020-05-22T00:00:00.000Z"));
	// let rsi = new RSI(symbol, dates, prices);
	// rsi.initialize(10, 40, 70);
	// console.log(rsi.graph);
	// console.log(rsi.getAction("2020-06-10T00:00:00.000Z"));
	let macd = new MACD(symbol, dates, prices);
	macd.initialize(12, 26, 9);
	console.log(macd.signalLine);
	console.log(macd.getAction("2020-03-26T00:00:00.000Z"))

	res.send('respond with a resource');
});

module.exports = router;
