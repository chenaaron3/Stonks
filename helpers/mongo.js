const MongoClient = require('mongodb').MongoClient;
const client = new MongoClient(process.env.MONGO_DATABASE_URL, {
	useUnifiedTopology: true
});

let stonks;
let priceCollection;
// connect to mongodb
client.connect(async function(err) {
	// get mongo collection
	stonks = client.db('stonks');
	priceCollection = stonks.collection('prices');
});

function getStockInfo(symbol) {
	return new Promise(async(resolve, reject) => {
		// get stock info matching symbol
		let stockInfo = await priceCollection.find({
			"_id": symbol
		});
		resolve(stockInfo);
	});
}

function addStockInfo(symbol, pricesList) {
	return new Promise(async(resolve, reject) => {
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
	addStockInfo
};