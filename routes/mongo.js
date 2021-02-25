var express = require('express');
var router = express.Router();
var path = require('path');
var fs = require('fs');
const { fork } = require('child_process');

let { getCollection, addDocument, getDocument, deleteDocument, deleteCollection } = require('../helpers/mongo');
let { makeid, daysBetween, hoursBetween } = require('../helpers/utils');
let { getSymbols, updateBacktest, getActionsToday } = require('../helpers/backtest');
let { getUpdatedPrices, fixFaulty, checkSplit, update } = require('../helpers/stock');
let { addJob } = require('../helpers/queue');

let PATH_TO_METADATA = path.join(__dirname, "../res/metadata.json");

ensureUpdated();
// ensure our database is constantly updated
async function ensureUpdated() {
	console.log("Retreiving metadata...");
	let metadata = JSON.parse(fs.readFileSync(PATH_TO_METADATA));
	let date = new Date();
	let pstHour = date.getUTCHours() - 8;
	if (pstHour < 0) pstHour += 24;
	// check for new day
	if (daysBetween(new Date(metadata["lastUpdated"]), new Date()) > 0) {
		// market closed
		if (pstHour >= 13) {
			console.log("Update required!");
			update();
			metadata["lastUpdated"] = new Date().toString();
			fs.writeFileSync(PATH_TO_METADATA, JSON.stringify(metadata));

			// check for splits on saturdays
			if (date.getDay() == 6) {
				checkSplit();
			}

			// update the active backtests
			let activeResults = await getDocument("results", "activeResults");
			if (activeResults) {
				activeResults = activeResults["activeResults"];
				for (let i = 0; i < activeResults.length; ++i) {
					let { id, email } = activeResults[i];
					updateBacktest(id); // update backtest
					getActionsToday(id, email); // send email notifications about sells, send buy orders to alpaca
				}
			}
		}
		// market not closed
		else {
			console.log("Waiting for market to close to update!");
		}
	}
	else {
		console.log("Already updated!");
	}
	// checks for updates every hour
	setTimeout(() => { ensureUpdated() }, 1000 * 60 * 60 * 1);
}

router.purge("/reset", async function (req, res) {
	res.send("Resetting!");
	// clear prices collection;
	addJob(() => {
		return new Promise(async resolveJob => {
			await deleteCollection("prices");
			await fill();
			resolveJob();
		})
	});
	// fill in the prices
	update();
})

router.get("/fill", async function (req, res) {
	res.send("Filling!");
	await fill();
})

router.get('/actions', async function (req, res, next) {
	// respond so doesnt hang
	res.send("Getting actions!");
	let activeResults = await getDocument("results", "activeResults");
	if (activeResults) {
		activeResults = activeResults["activeResults"];
		for (let i = 0; i < activeResults.length; ++i) {
			let { id, email } = activeResults[i];
			getActionsToday(id, email); // send email notifications about sells, send buy orders to alpaca
		}
	}
});

// create skeleton docs
async function fill() {
	console.log("Filling!");
	let symbols = await getSymbols(false);
	let baseDate = "1/1/1500";
	for (let i = 0; i < symbols.length; ++i) {
		let symbol = symbols[i];
		await addDocument("prices", { _id: symbol, prices: [], lastUpdated: baseDate });
	}
	console.log("Finished Filling!");
}

router.get('/update', async function (req, res, next) {
	// respond so doesnt hang
	res.send("Updating!");
	update();
});

router.get('/pop', async function (req, res) {
	// respond so doesnt hang
	res.send("Popping!");
	let amount = req.query["amount"] ? parseInt(req.query["amount"]) : 1;

	// get all docs from mongo
	console.log("Retreiving symbols!");
	let priceCollection = await getCollection("prices");
	let stockInfo = await priceCollection.find({}).project({ _id: 1, lastUpdated: 1 })//.limit(10);
	stockInfo = await stockInfo.toArray();
	console.log(`Retreived ${stockInfo.length} symbols!`);

	// pop from each document
	for (let i = 0; i < stockInfo.length; ++i) {
		let symbol = stockInfo[i]["_id"];
		for (let j = 0; j < amount; ++j) {
			// pop the price
			await priceCollection.updateOne({ _id: symbol }, { $pop: { prices: 1 } })
		}
		// get the last date
		let doc = await priceCollection.findOne({ _id: symbol });
		let docPrices = doc["prices"];
		let lastDate = "1/1/1500";
		if (docPrices.length > 0) {
			lastDate = docPrices[docPrices.length - 1]["date"]
		}
		// update the last updated 
		await priceCollection.updateOne({ _id: symbol }, { $set: { "lastUpdated": lastDate } });
		console.log("Popped", symbol);
	}
});

// trim database of stocks with no data
router.get('/trim', async function (req, res) {
	res.send("Trimming");

	// get all docs
	console.log("Retreiving symbols!");
	let priceCollection = await getCollection("prices");
	let stockInfo = await priceCollection.find({}).project({ _id: 1, lastUpdated: 1 });
	stockInfo = await stockInfo.toArray();
	console.log(`Retreived ${stockInfo.length} symbols!`);

	let numEmpty = 0;
	for (let i = 0; i < stockInfo.length; ++i) {
		let doc = await getDocument("prices", stockInfo[i]["_id"]);
		if (doc["prices"].length < 5) {
			console.log(doc["_id"]);
			numEmpty += 1
			deleteDocument("prices", doc["_id"]);
		}
	}
	console.log("Total Empty", numEmpty);

});

// check if any symbols needs an update because of a split
router.get("/checkSplit", async function (req, res) {
	res.send("Checking for Splits");
	checkSplit();
});

// try to fix faulty data
router.get("/fixFaulty", async function (req, res) {
	res.send("Fixing faulty data");
	let results = await fixFaulty();
	console.log(results);
});

// clear active results
router.get("/clearActiveResults", async function (req, res) {
	await deleteDocument("results", "activeResults");
	res.send("Cleared");
})

module.exports = router;