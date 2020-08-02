const MongoClient = require('mongodb').MongoClient;
const client = new MongoClient(process.env.MONGO_DATABASE_URL, {
	useUnifiedTopology: true
});

let stonks;
let priceCollection;
let resultsCollection;

// ensure that there is a valid connection
function ensureConnected() {
	return new Promise(resolve => {
		// if not connected yet
		if (!priceCollection) {
			// create a connection
			client.connect(async function (err) {
				if (err) console.log(err);
				// get mongo collection
				stonks = client.db('stonks');
				priceCollection = stonks.collection('prices');
				resultsCollection = stonks.collection('results');
				resolve();
			});
		}
		// resolve immediately
		else {
			resolve();
		}
	});
}

// gets collection object by name
function getCollection(collectionName) {
	return new Promise(async (resolve, reject) => {
		await ensureConnected();
		// check if collection exists
		stonks.listCollections({ name: collectionName })
			.next(function (err, collection) {
				if (err) reject(err);
				if (collection) {
					resolve(stonks.collection(collectionName));
				}
				else {
					reject(`Collection ${collectionName} does not exist!`);
				}
			});
	});
}

// gets a document from a collection
function getDocument(collectionName, documentID) {
	return new Promise(async (resolve, reject) => {
		await ensureConnected();
		// get collection
		getCollection(collectionName)
			.then(async (collection) => {
				// get document
				let results = await collection.find({
					"_id": documentID
				});
				let documents = await results.toArray();
				if (documents.length > 0) {
					resolve(documents[0]);
				}
				else {
					reject(`Document ${documentID} does not exist in Collection ${collectionName}`);
				}

			})
			.catch(err => reject(err));
	});
}

// checks if id exists in result collection
function containsID(id) {
	return new Promise(async (resolve, reject) => {
		await ensureConnected();
		resolve(resultsCollection.find({
			"_id": id
		}).count() > 0);
	});
}

// adds a skeleton document to result collection
function addID(id) {
	return new Promise(async (resolve, reject) => {
		await ensureConnected();
		// update collection
		resultsCollection.insertOne({
			"_id": id,
			"results": 'Results are not ready yet!'
		}, (error) => {
			if (error) reject(`failed to insert id with ${id}, error ${error}`);
			else resolve(`updated collection with unique id ${id}`);
		});
	});
}

// adds a document to result collection
function addResult(id, result) {
	return new Promise(async (resolve, reject) => {
		await ensureConnected();
		await resultsCollection.updateOne({
			"_id": id
		},
			{
				$set: { "results": result }
			}, (err, res) => {
				if (err) console.log(err);
				resolve(result);
			});
	});
}

// gets a document from prices collection
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

// adds a new document in prices collection
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

// updates a stock by adding prices to it
function updateStockInfo(symbol, pricesList) {
	return new Promise(async (resolve, reject) => {
		await ensureConnected();
		let today = new Date();
		await priceCollection.updateOne({
			"_id": symbol
		}, {
			$addToSet: {
				"prices": {
					$each: pricesList
				}
			},
			$set: {
				"lastUpdated": today.toString()
			}
		});
		resolve();
	});
}

module.exports = {
	getCollection,
	getDocument,
	getStockInfo,
	addStockInfo,
	containsID,
	addID,
	addResult,
	updateStockInfo
};