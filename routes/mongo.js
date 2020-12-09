var express = require('express');
var router = express.Router();
var path = require('path');
var fs = require('fs');
const { fork } = require('child_process');

let { getCollection, addDocument, getDocument, deleteDocument } = require('../helpers/mongo');
let { makeid, daysBetween, hoursBetween } = require('../helpers/utils');
let { getSymbols, updateBacktest, getActionsToday } = require('../helpers/backtest');
let { getUpdatedPrices } = require('../helpers/stock');
let { addJob } = require('../helpers/queue');

const NUM_THREADS = 4;
let PATH_TO_METADATA = path.join(__dirname, "../res/metadata.json");

ensureUpdated();
// ensure our database is constantly updated
function ensureUpdated() {
	console.log("Retreiving metadata...");
	let metadata = JSON.parse(fs.readFileSync(PATH_TO_METADATA));
	let date = new Date();
	let pstHour = date.getUTCHours() - 7;
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
			let activeBacktests = getDocument("results", "activeResults");
			for (let i = 0; i < activeBacktests.length; ++i) {
				let { id, email } = activeBacktests[i];
				updateBacktest(id);
				getActionsToday(id, email);
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

router.get("/fill", async function (req, res) {
	res.send("Filling!");
	let symbols = await getSymbols();
	let baseDate = "1/1/1500";
	for (let i = 0; i < symbols.length; ++i) {
		let symbol = symbols[i];
		await addDocument("prices", { _id: symbol, prices: [], lastUpdated: baseDate });
	}
	console.log("Finished Filling!");
})

/* GET users listing. */
router.get('/update', async function (req, res, next) {
	// respond so doesnt hang
	res.send("Updating!");
	update();
});

async function update() {
	addJob(() => {
		return new Promise(async resolveJob => {
			// get all docs from mongo
			console.log("Retreiving symbols!");
			let priceCollection = await getCollection("prices");
			let stockInfo = await priceCollection.find({}).project({ _id: 1, lastUpdated: 1, prices: { $slice: -1 } })//.limit(10);
			stockInfo = await stockInfo.toArray();
			console.log(`Retreived ${stockInfo.length} symbols!`);

			// create id to identify the update in logs
			let updateID = makeid(5);

			// create threads that split up the work
			let partitionSize = Math.ceil(stockInfo.length / NUM_THREADS);
			let finishedWorkers = 0;
			for (let i = 0; i < NUM_THREADS; ++i) {
				// divy up the documents for each thread to work on
				let partition = stockInfo.slice(i * partitionSize, (i + 1) * partitionSize);

				// spawn child to do work
				let child = fork(path.join(__dirname, "../helpers/worker.js"));
				child.send({ type: "startUpdate", partition, updateID });
				child.on('message', function (message) {
					if (message.status == "finished") {
						if (++finishedWorkers == NUM_THREADS) {
							console.log("Symbol Update Complete");
							resolveJob();
						}
					}
				});
			}
		})
	}, true)
}

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
router.get("/checkSplits", async function (req, res) {
	res.send("Checking for Splits");
	checkSplit();
});

async function checkSplit() {
	console.log("Checking for Splits");
	addJob(() => {
		return new Promise(async resolveJob => {
			let priceCollection = await getCollection("prices");
			// check all stocks for their beginning price
			let stockInfo = await priceCollection.find({}).project({ _id: 1, prices: { $slice: 1 } });
			stockInfo = await stockInfo.toArray();

			// create id to identify the job in logs
			let jobID = makeid(5);

			// create threads that split up the work
			let partitionSize = Math.ceil(stockInfo.length / NUM_THREADS);
			let finishedWorkers = 0;
			let totalChanges = 0;
			for (let i = 0; i < NUM_THREADS; ++i) {
				// divy up the documents for each thread to work on
				let partition = stockInfo.slice(i * partitionSize, (i + 1) * partitionSize);

				// spawn child to do work
				let child = fork(path.join(__dirname, "../helpers/worker.js"));
				child.send({ type: "startSplitCheck", partition, jobID });
				child.on('message', function (message) {
					if (message.status == "finished") {
						totalChanges += message.changes;
						if (++finishedWorkers == NUM_THREADS) {
							console.log("Symbol Split Check Complete With", totalChanges, "Changes!");
							resolveJob();
						}
					}
				});
			}
		})
	});
}

module.exports = router;