var express = require('express');
var router = express.Router();
var vendor = require('../helpers/vendor');
let fetch = require('node-fetch');

var path = require('path');
var fs = require('fs');
let PATH_TO_CACHE = path.join(__dirname, "../res/priceCache.json");
let {
	formatDate,
	daysBetween
} = require('../helpers/utils');

const MongoClient = require('mongodb').MongoClient;
const client = new MongoClient(process.env.MONGO_DATABASE_URL, {
	useUnifiedTopology: true
});
const BASE_URL = "https://api.tiingo.com/tiingo/daily";

/* GET users listing. */
router.get('/update', function(req, res, next) {
	var today = new Date();

	// connect to mongodb
	client.connect(async function(err) {
		const stonks = client.db('stonks');
		const priceCollection = stonks.collection('prices');

		res.send("Updating!");

		let stockInfo = await priceCollection.find({}).limit(5);
		stockInfo.forEach(async function(doc) {
			let symbol = doc._id;
			let lastUpdated = doc.lastUpdated;
			console.log("Checking ", symbol, " for update...");
			// if need an update
			if (daysBetween(new Date(lastUpdated), today) > 0) {
				console.log("Updating right now!");
				let index = vendor.getSymbolIndex(symbol);
				let attempts = 0;
				let priceData = undefined;
				// keep trying to get data until a valid key is found
				while (true) {
					let key = vendor.getKey(index, attempts);
					try {
						priceData = await getPrice(doc._id, doc.lastUpdated, key);
						break;
					} catch (e) {
						console.log("Error! ", e);
					}
					attempts += 1;
					// bail if max attempts reached
					if (attempts > vendor.numKeys()) {
						console.log("MAX KEY FAILURE!!!!");
						break;
					}
				}
				// if succesfully retrieved data
				if (priceData != undefined) {
					console.log("Got the data!");
					console.log(priceData);
					priceCollection.update({
						"_id": doc._id
					}, {
						$addToSet: {
							"prices": {
								$each: priceData
							}
						}
					});
					priceCollection.update({
						"_id": doc._id 
					}, {
						$set: {
							"lastUpdated": today.toString()
						}
					});
				}
			}
		});
	});
});

function getPrice(symbol, startDate, key) {
	return new Promise(async (resolve, reject) => {
		try {
			// fetch price data from API
			let priceResponse = await fetch(BASE_URL + `/${symbol}/prices?startDate=${formatDate(startDate)}`, {
				method: 'get',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Token ${key}`
				},
			});
			let priceText = await priceResponse.text();
			let priceJSON = JSON.parse(priceText);
			// if failed because of key error
			if (priceJSON["detail"]) {
				reject(priceJSON["detail"]);
			} else {
				resolve(priceJSON);
			}
		} catch (e) {
			reject(e);
		}
	});
}

module.exports = router;