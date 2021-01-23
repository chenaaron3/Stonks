const MongoClient = require('mongodb').MongoClient;
const bson = require('bson');
const DOC_LIMIT = 15000000;

let stonks;
let priceCollection;
let resultsCollection;

let mongoURL = process.env.NODE_ENV == "production" ? process.env.PROD_MONGO_DATABASE_URL : process.env.MONGO_DATABASE_URL

const client = new MongoClient(mongoURL, {
	useUnifiedTopology: true
});

// ensure that there is a valid connection
function ensureConnected() {
	return new Promise(resolve => {
		// if not connected yet
		if (!priceCollection) {
			// create a connection
			client.connect(async function (err) {
				if (err) {
					console.log("Connection failed!", err);
					resolve();
				}
				console.log("Connected!");
				// get mongo collection
				stonks = client.db('stonks');
				let collections = await stonks.listCollections().toArray();
				let collectionNames = [];
				collections.forEach(collection => {
					collectionNames.push(collection["name"])
				})

				if (!collectionNames.includes("prices")) {
					await stonks.createCollection("prices");
				}
				if (!collectionNames.includes("results")) {
					await stonks.createCollection("results");
				}

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
		if (collectionName == "prices") {
			resolve(priceCollection);
		}
		else if (collectionName == "results") {
			resolve(resultsCollection);
		}
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

function addDocument(collectionName, document) {
	return new Promise(async (resolve, reject) => {
		await ensureConnected();
		console.log("Add doc to ", collectionName, "with id", document["_id"])

		// get collection
		getCollection(collectionName)
			.then(async (collection) => {
				// if document not in collection already
				let count = await collection.countDocuments({"_id": document["_id"] });
				console.log(count);
				if (count == 0) {
					// Add the document
					collection.insertOne(document, (error) => {
						if (error) {
							console.log("Add Doc Error", error);
							reject(error);
						}
						else resolve();
					});
				}
				else {
					resolve();
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
					// check if fragmented
					let doc = documents[0];
					if (doc.hasOwnProperty("_fragmentData")) {
						let fragmentData = doc["_fragmentData"];
						let options = fragmentData["options"];
						let data;
						let promises = fragmentData["ids"].map(fragmentID => getDocument(collectionName, fragmentID));
						let fragments = await Promise.all(promises);
						if (fragmentData["type"] == "array") {
							data = [];
							fragments.forEach(f => {
								data = data.concat(f["fragment"]);
							})
						}
						else {
							data = {};
							fragments.forEach(f => {
								Object.assign(data, f["fragment"]);
							})
						}
						if (options["subField"]) {
							doc[fragmentData["field"]][options["subField"]] = data;
						}
						else {
							doc[fragmentData["field"]] = data;
						}
					}
					resolve(doc);
				}
				else {
					reject(`Document ${documentID} does not exist in Collection ${collectionName}`);
				}

			})
			.catch(err => reject(err));
	});
}

function deleteDocument(collectionName, documentID) {
	return new Promise(async (resolve, reject) => {
		await ensureConnected();
		// get collection
		getCollection(collectionName)
			.then(async (collection) => {
				// get document
				await collection.deleteOne({
					"_id": documentID
				});
				resolve();
			})
			.catch(err => reject(err));
	});
}

// checks if id exists in result collection
function containsID(collectionName, id) {
	return new Promise(async (resolve, reject) => {
		await ensureConnected();
		getCollection(collectionName)
			.then(async (collection) => {
				resolve(await collection.find({
					"_id": id
				}).count() > 0);
			})
			.catch(err => reject(err));
	});
}

function setDocumentField(collectionName, id, fieldName, value, splitOptions) {
	return new Promise(async (resolve, reject) => {
		await ensureConnected();
		getCollection(collectionName)
			.then(async (collection) => {
				await collection.updateOne({
					"_id": id
				},
					{
						$set: { [fieldName]: value }
					}, (err, res) => {
						if (err) {
							// check if size is too large
							if (bson.calculateObjectSize(value)) {
								console.log("TOO LARGE");
								splitField(collectionName, id, fieldName, value, splitOptions)
									.then(() => resolve())
									.catch(err => {
										console.log("ERR: ", err);
										reject(err)
									});
							}
							// some other error
							else {
								reject(err);
							}
						}
						else {
							let doc = getDocument(collectionName, id);
							if (doc["_fragmentData"] && doc["_fragmentData"]["field"] == fieldName) {
								setDocumentField(collectionName, id, "_fragmentData", undefined);
							}
							resolve();
						}
					});
			})
	});
}

// helper method to split large documents
async function splitField(collectionName, id, fieldName, value, splitOptions) {
	return new Promise(async (resolve, reject) => {
		if (!splitOptions) {
			reject("No split options");
			return;
		}

		// offending field may be nested 
		let offendingField = value;
		if (splitOptions["subField"]) {
			offendingField = value[splitOptions["subField"]];
		}
		console.log("Offending fields found")

		// can only split arrays or objects
		if (typeof offendingField == "object") {
			// determine how to split
			let fragmentData = {
				field: fieldName,
				options: splitOptions,
				type: "",
				ids: []
			};
			let size = bson.calculateObjectSize(offendingField);
			let numFragments = Math.ceil(size / DOC_LIMIT);
			let fragments = [];

			// slice array
			if (Array.isArray(offendingField)) {
				console.log("Array", offendingField);
				fragmentData["type"] = "array";
				let fragmentSize = Math.ceil(offendingField.length / numFragments);
				for (let i = 0; i < numFragments; ++i) {
					fragments.push(offendingField.slice(i * fragmentSize, (i + 1) * fragmentSize));
				}
				if (splitOptions["subField"]) {
					value[splitOptions["subField"]] = [];
				}
				else {
					value = [];
				}
			}
			// slice object keys
			else {
				console.log("Object", Object.keys(offendingField));
				fragmentData["type"] = "object";
				let keys = Object.keys(offendingField).sort();
				let fragmentSize = Math.ceil(keys.length / numFragments);
				for (let i = 0; i < numFragments; ++i) {
					let dict = {};
					keys.slice(i * fragmentSize, (i + 1) * fragmentSize)
						.forEach(k => dict[k] = offendingField[k]);
					fragments.push(dict);
				}
				if (splitOptions["subField"]) {
					value[splitOptions["subField"]] = [];
				}
				else {
					value = [];
				}
			}

			// create fragment docs
			for (let i = 0; i < fragments.length; ++i) {
				let fragID = id + "_" + i;
				console.log(fragID, bson.calculateObjectSize(fragments[i]));
				await addDocument(collectionName, { _id: fragID, fragment: fragments[i] });
				fragmentData["ids"].push(fragID);
			}

			// cache fragment data
			await setDocumentField(collectionName, id, "_fragmentData", fragmentData);

			// clear the offending field
			await setDocumentField(collectionName, id, fieldName, value);

			console.log(fragmentData)
			resolve();
		}
		else {
			reject("Can only split Objects or Arrays");
		}
	})
}

// rewrite a stock's price history
function setStockInfo(symbol, pricesList, updateDate) {
	return new Promise(async (resolve, reject) => {
		await ensureConnected();
		await priceCollection.updateOne({
			"_id": symbol
		},
			{
				$set: { prices: pricesList, lastUpdated: updateDate.toString() }
			}, (err, res) => {
				if (err) reject(err);
			});
		resolve();
	});
}

// updates a stock by adding prices to it
function updateStockInfo(symbol, pricesList, updateDate) {
	return new Promise(async (resolve, reject) => {
		await ensureConnected();
		await priceCollection.updateOne({
			"_id": symbol
		}, {
			$addToSet: {
				"prices": {
					$each: pricesList
				}
			},
			$set: {
				"lastUpdated": updateDate.toString()
			}
		});
		resolve();
	});
}

function addActiveResult(id) {
	return new Promise(async (resolve, reject) => {
		await ensureConnected();
		let key = "activeResults";

		// add document if doesnt exist
		if ((await resultsCollection.find({ _id: key }).count()) == 0) {
			await addDocument("results", { _id: key, [key]: [] });
		}

		await resultsCollection.updateOne({
			"_id": key
		}, {
			$addToSet: {
				"activeResults": id
			}
		}, {
			upsert: true
		});
		resolve();
	});
}

function deleteActiveResult(id) {
	return new Promise(async (resolve, reject) => {
		await ensureConnected();
		let key = "activeResults";

		if ((await resultsCollection.find({ _id: key }).count()) != 0) {
			await resultsCollection.updateOne({
				"_id": key
			}, {
				$pull: {
					"activeResults": id
				}
			});
		}

		resolve();
	});
}

module.exports = {
	getCollection,
	addDocument,
	getDocument,
	setDocumentField,
	deleteDocument,
	containsID,
	setStockInfo,
	updateStockInfo,
	addActiveResult,
	deleteActiveResult
};