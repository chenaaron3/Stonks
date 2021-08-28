import express, { Request, Response } from 'express';

import { getCollection, addDocument, getDocument, deleteDocument, deleteCollection, createCollection, setDocumentField } from '../helpers/mongo';
import { daysBetween } from '../helpers/utils';
import { updateBacktest, getActionsToday } from '../helpers/backtest';
import { fixFaulty, checkSplit, update, fill } from '../helpers/stock';
import { addJob } from '../helpers/queue';

import { MongoActiveResults, COLLECTION_NAMES } from '../types/types';
import { Timeframe } from '@shared/common';

import API from '@shared/api';

const router = express.Router();

ensureUpdated();
// ensure our database is constantly updated
async function ensureUpdated() {
	console.log("Retreiving metadata...");
	let metadata = await getDocument('metadata', 'metadata');
	// create metadata if missing
	if (!metadata) {
		metadata = { "_id": "metadata", "lastUpdated": new Date() };
		await createCollection('metadata')
		await addDocument("metadata", metadata);
	}
	console.log(metadata)
	let date = new Date();
	let pstHour = date.getUTCHours() - 8;
	if (pstHour < 0) pstHour += 24;
	// check for new day
	if (daysBetween(new Date(metadata["lastUpdated"]), new Date()) > 0) {
		// market closed
		if (pstHour >= 13) {
			console.log("Update required!");
			update("1Day");
			await setDocumentField('metadata', "metadata", "lastUpdated", new Date().toString(), undefined);

			// check for splits on saturdays
			if (date.getDay() == 6) {
				// checkSplit();
			}

			// update the active backtests
			let activeResultsDoc = await getDocument<MongoActiveResults>("results", "activeResults");
			if (activeResultsDoc) {
				let activeResults = activeResultsDoc["activeResults"];
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

router.get('/update', async function (
	req: Request<{}, {}, {}, API.Mongo.GetUpdate>,
	res: Response<API.Mongo._GetUpdate>) {
	// respond so doesnt hang
	res.json({ status: "Updating!" });
	let timeframe = req.query.timeframe ? req.query.timeframe : "1Day";
	update(timeframe);
});

// gets the actions for active results
router.get('/actions', async function (
	req: Request<{}, {}, {}, API.Mongo.GetActions>,
	res: Response<API.Mongo._GetActions>) {
	// respond so doesnt hang
	res.json({ status: "Getting actions!" });
	let activeResultsDoc = await getDocument<MongoActiveResults>("results", "activeResults");
	if (activeResultsDoc) {
		let activeResults = activeResultsDoc["activeResults"];
		for (let i = 0; i < activeResults.length; ++i) {
			let { id, email } = activeResults[i];
			getActionsToday(id, email); // send email notifications about sells, send buy orders to alpaca
		}
	}
});

// clear active results
router.get("/clearActiveResults", async function (
	req: Request<{}, {}, {}, API.Mongo.GetClearActiveResults>,
	res: Response<API.Mongo._GetClearActiveResults>) {
	await deleteDocument("results", "activeResults");
	res.send({ status: "Cleared" });
})

// reset prices collection
router.purge("/reset", async function (
	req: Request<{}, {}, {}, API.Mongo.PurseReset>,
	res: Response<API.Mongo._PurseReset>) {
	res.json({ status: "Resetting!" });
	let timeframe: Timeframe = req.query.timeframe ? req.query.timeframe : "1Day";
	console.log(timeframe)
	// clear prices collection;
	addJob(() => {
		return new Promise(async resolveJob => {
			try {
				await deleteCollection(("prices" + timeframe) as COLLECTION_NAMES);
			}
			catch (e) {
				console.log(e);
			}
			await createCollection("prices" + timeframe);
			await fill(timeframe);
			resolveJob();
		})
	});
	// fill in the prices
	update(timeframe);
})

// fills symbols for a price collection
router.get("/fill", async function (
	req: Request<{}, {}, {}, API.Mongo.GetFill>,
	res: Response<API.Mongo._GetFill>) {
	res.json({ status: "Filling!" });
	let timeframe = req.query.timeframe ? req.query.timeframe : "1Day";
	await fill(timeframe);
})

// pop x items from a price collection
router.get('/pop', async function (
	req: Request<{}, {}, {}, API.Mongo.GetPop>,
	res: Response<API.Mongo._GetPop>) {
	// respond so doesnt hang
	res.json({ status: "Popping!" });
	let amount = req.query["amount"] ? parseInt(req.query["amount"]) : 1;
	let timeframe = req.query.timeframe ? req.query.timeframe : "1Day";

	// get all docs from mongo
	console.log("Retreiving symbols from mongo!");
	let priceCollection = await getCollection(("prices" + timeframe) as COLLECTION_NAMES);
	let stockInfo = await priceCollection.find({}).project({ _id: 1, lastUpdated: 1 }).toArray()//.limit(10);
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
		let docPrices = doc!["prices"];
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
router.get('/trim', async function (
	req: Request<{}, {}, {}, API.Mongo.GetTrim>,
	res: Response<API.Mongo._GetTrim>) {
	res.json({ status: "Trimming" });
	let timeframe = req.query.timeframe ? req.query.timeframe : "1Day";

	// get all docs
	console.log("Retreiving symbols from mongo!");
	let priceCollection = await getCollection(("prices" + timeframe) as COLLECTION_NAMES);
	let stockInfo = await priceCollection.find({}).project({ _id: 1, lastUpdated: 1 }).toArray();
	console.log(`Retreived ${stockInfo.length} symbols!`);

	let numEmpty = 0;
	for (let i = 0; i < stockInfo.length; ++i) {
		let doc = await getDocument(("prices" + timeframe) as COLLECTION_NAMES, stockInfo[i]["_id"]);
		if (doc && doc["prices"].length < 5) {
			console.log(doc["_id"]);
			numEmpty += 1
			deleteDocument(("prices" + timeframe) as COLLECTION_NAMES, doc["_id"]);
		}
	}
	console.log("Total Empty", numEmpty);

});

// check if any symbols needs an update because of a split
router.get("/checkSplit", async function (
	req: Request<{}, {}, {}, API.Mongo.GetCheckSplit>,
	res: Response<API.Mongo._GetCheckSplit>) {
	res.json({ status: "Checking for Splits" });
	checkSplit();
});

// try to fix faulty data
router.get("/fixFaulty", async function (
	req: Request<{}, {}, {}, API.Mongo.GetCheckSplit>,
	res: Response<API.Mongo._GetCheckSplit>) {
	res.json({ status: "Fixing faulty data" });
	let results = await fixFaulty();
	console.log(results);
});

export = router;