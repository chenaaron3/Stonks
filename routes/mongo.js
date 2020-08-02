var express = require('express');
var router = express.Router();
var path = require('path');
const { fork } = require('child_process');

let { getCollection } = require('../helpers/mongo');
let { makeid } = require('../helpers/utils');

const NUM_THREADS = 5;

/* GET users listing. */
router.get('/update', async function (req, res, next) {
	// respond so doesnt hang
	res.send("Updating!");

	// get all docs
	console.log("Retreiving symbols!");
	let priceCollection = await getCollection("prices");
	let stockInfo = await priceCollection.find({}).project({ _id: 1, lastUpdated: 1 });
	stockInfo = await stockInfo.toArray();
	console.log(`Retreived ${stockInfo.length} symbols!`);

	// create id to identify the update in logs
	let updateID = makeid(5);

	// create threads that split up the work
	let partitionSize = Math.ceil(stockInfo.length / NUM_THREADS);
	for (let i = 0; i < NUM_THREADS; ++i) {
		// divy up the documents for each thread to work on
		let partition = stockInfo.slice(i * partitionSize, (i + 1) * partitionSize);

		// spawn child to do work
		let child = fork(path.join(__dirname, "../helpers/worker.js"));
		child.send({ type: "startUpdate", partition, updateID });
	}
});

module.exports = router;