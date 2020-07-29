var express = require('express');
var router = express.Router();

let SMA = require('../helpers/sma');
let RSI = require('../helpers/rsi');
let MACD = require('../helpers/macd');
var path = require('path');
var fs = require('fs');
let {
	getStockInfo
} = require('../helpers/mongo');
let PATH_TO_CACHE = path.join(__dirname, "../res/priceCache.json");

/* GET users listing. */
router.get('/', async function(req, res, next) {
	// Method 1: using await
	let stockInfo = await getStockInfo("A");
	stockInfo = await stockInfo.toArray();
	res.json(stockInfo);

	// Method 2: using .then
	// getStockInfo("A").then(stockInfo => {
	// 	console.log(stockInfo);
	// });
});

module.exports = router;