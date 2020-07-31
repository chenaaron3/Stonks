const MongoClient = require('mongodb').MongoClient;
const client = new MongoClient(process.env.MONGO_DATABASE_URL, {
	useUnifiedTopology: true
});

let stonks;
let priceCollection;
// connect to mongodb
client.connect(async function (err) {
	// get mongo collection
	stonks = client.db('stonks');
	priceCollection = stonks.collection('prices');
	resultsCollection = stonks.collection('results');
	console.log("Collections loaded!");
});

function ensureConnected() {
	return new Promise(resolve => {
		if (!priceCollection) {
			client.connect(async function (err) {
				// get mongo collection
				stonks = client.db('stonks');
				priceCollection = stonks.collection('prices');
				resultsCollection = stonks.collection('results');
				resolve();
			});
		}
		else {
			resolve();
		}
	});
}

function containsID(id) {
	return new Promise(async (resolve, reject) => {
		await ensureConnected();
		resolve(resultsCollection.find({
			"_id": id
		}).count() > 0);
	});
}

function addID(id) {
	return new Promise(async (resolve, reject) => {
		await ensureConnected();
		// update collection
		resultsCollection.insertOne({
			"_id": id,
			"results": ''
		}, (error) => {
			if (error) reject(`failed to insert id with ${id}, error ${error}`);
			else resolve(`updated collection with unique id ${id}`);
		});
	});
}

function addResult(id, result) {
	return new Promise(async (resolve, reject) => {
		await ensureConnected();
		await resultsCollection.updateOne({
			"_id": id
		},
			{
				$set: { "_id": id, "results": result }
			});
		resolve(result);
	});
}

function getStockInfo(symbol) {
	return new Promise(async (resolve, reject) => {
		await ensureConnected();
		// get stock info matching symbol
		let stockInfo = await priceCollection.find({
			"_id": symbol
		});
		resolve(stockInfo);
	});
}

function addStockInfo(symbol, pricesList) {
	return new Promise(async (resolve, reject) => {
		await ensureConnected();
		let today = new Date();
		// update collection
		priceCollection.insertOne({
			"_id": symbol,
			"prices": pricesList,
			"lastUpdated": today
		}, (error) => {
			if (error) reject(`failed to updated collection with ${symbol}, error ${error}`);
			else resolve(`updated collection with ${symbol}`);
		});
	});
}

module.exports = {
	getStockInfo,
	addStockInfo,
	containsID,
	addID,
	addResult
};