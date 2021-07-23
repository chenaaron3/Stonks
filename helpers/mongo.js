const MongoClient = require('mongodb').MongoClient;
const bson = require('bson');
const DOC_LIMIT = 10000000;

let stonks;
let resultsCollection;

let mongoURL = process.env.MONGO_DATABASE_URL

const client = new MongoClient(mongoURL, {
	useUnifiedTopology: true
});

// ensure that there is a valid connection
function ensureConnected() {
	return new Promise(resolve => {
		// if not connected yet
		if (!stonks) {
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

				if (!collectionNames.includes("results")) {
					await stonks.createCollection("results");
				}
				if (!collectionNames.includes("indicators")) {
					await stonks.createCollection("indicators");
				}
				if (!collectionNames.includes("users")) {
					await stonks.createCollection("users");
				}

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
		if (collectionName == "results") {
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

function createCollection(collectionName) {
	return new Promise(async (resolve, reject) => {
		await ensureConnected();
		await stonks.createCollection(collectionName);
		resolve();
	});
}

function addDocument(collectionName, document) {
	return new Promise(async (resolve, reject) => {
		await ensureConnected();
		// get collection
		getCollection(collectionName)
			.then(async (collection) => {
				// if document not in collection already
				let count = await collection.countDocuments({ "_id": document["_id"] });
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

						// fetch all fragments
						let promises = fragmentData["ids"].map(fragmentID => getDocument(collectionName, fragmentID));
						let fragments = await Promise.all(promises);

						// check reconstruction method
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

						// apply reconstructed data to doc
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
					console.log(`Document ${documentID} does not exist in Collection ${collectionName}`);
					resolve(undefined);
				}

			})
			.catch(err => {
				console.log(`${err}: Could not get collection ${collectionName}`);
				resolve(undefined)
			});
	});
}

function deleteCollection(collectionName) {
	return new Promise(async (resolve, reject) => {
		await ensureConnected();
		// get collection
		getCollection(collectionName)
			.then(async (collection) => {
				// delete
				await collection.drop();
				resolve();
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
				// get document to check for fragments
				let frag = await getDocumentField(collectionName, documentID, ["_fragmentData"]);
				if (frag && frag["_fragmentData"]) {
					// delete doc's fragments first
					for (let i = 0; i < frag["_fragmentData"]["ids"].length; ++i) {
						let fragID = frag["_fragmentData"]["ids"][i];
						await collection.deleteOne({ "_id": fragID });
						console.log("Deleted frag", fragID);
					}
				}

				// delete main document
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

// push a value to an array
function pushDocumentField(collectionName, id, fieldName, value) {
	return new Promise(async (resolve, reject) => {
		await ensureConnected();
		getCollection(collectionName)
			.then(async collection => {
				await collection.updateOne({
					"_id": id
				}, {
					$addToSet: {
						[fieldName]: value
					}
				});
				resolve();
			})
	});
}

// concat arary to an array
function concatDocumentField(collectionName, id, fieldName, value) {
	return new Promise(async (resolve, reject) => {
		await ensureConnected();
		getCollection(collectionName)
			.then(async collection => {
				await collection.updateOne({
					"_id": id
				}, {
					$addToSet: {
						[fieldName]: {
							$each: value
						}
					}
				});
				resolve();
			})
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
					}, async (err, res) => {
						if (err) {
							// check if size is too large
							if (bson.calculateObjectSize(value)) {
								console.log("TOO LARGE");
								splitField(collectionName, id, fieldName, value, splitOptions)
									.then(() => {
										resolve()
									})
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
							let doc = await getDocumentField(collectionName, id, ["_fragmentData"]);
							if (doc && doc["_fragmentData"] && doc["_fragmentData"]["field"] == fieldName) {
								await setDocumentField(collectionName, id, "_fragmentData", undefined);
							}
							resolve();
						}
					});
			})
	});
}

async function getDocumentField(collectionName, id, fieldNames) {
	return new Promise(async (resolve, reject) => {
		await ensureConnected();
		getCollection(collectionName)
			.then(async (collection) => {
				// construct projection object
				let projection = {};
				fieldNames.forEach(fn => projection[fn] = true)
				let results = collection.find({
					"_id": id
				}).project(projection);

				// TODO if field is fragmented, need to reconstruct

				// cursor to object
				let array = await results.toArray();
				if (array.length > 0) {
					resolve(array[0]);
				}
				else {
					resolve(undefined);
				}
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
				// clear value
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
				// clear value
				if (splitOptions["subField"]) {
					value[splitOptions["subField"]] = {};
				}
				else {
					value = {};
				}
			}

			// delete previous fragments
			let previousFragments = await getDocumentField(collectionName, id, ["_fragmentData"]);
			if (previousFragments && previousFragments["_fragmentData"]) {
				console.log("Overwriting existing frags");
				for (let i = 0; i < previousFragments["_fragmentData"]["ids"].length; ++i) {
					console.log("Deleting frag", previousFragments["_fragmentData"]["ids"][i])
					await deleteDocument(collectionName, previousFragments["_fragmentData"]["ids"][i]);
				}
			}

			// create fragment docs
			console.log("Creating new frags");
			for (let i = 0; i < fragments.length; ++i) {
				let fragID = id + "_" + i;
				console.log(fragID, bson.calculateObjectSize(fragments[i]));
				await addDocument(collectionName, { _id: fragID, fragment: fragments[i] });
				fragmentData["ids"].push(fragID);
			}

			// clear the offending field, must do before setting fragment metadata or else metadata will be cleared
			await setDocumentField(collectionName, id, fieldName, value);
			// cache fragment data
			await setDocumentField(collectionName, id, "_fragmentData", fragmentData);

			console.log(fragmentData)
			resolve();
		}
		else {
			reject("Can only split Objects or Arrays");
		}
	})
}

// rewrite a stock's price history
function setStockInfo(symbol, pricesList, updateDate, timeframe) {
	return new Promise(async (resolve, reject) => {
		await ensureConnected();
		getCollection("prices" + timeframe)
			.then(async (collection) => {
				await collection.updateOne({
					"_id": symbol
				},
					{
						$set: { prices: pricesList, lastUpdated: updateDate.toString() }
					}, (err, res) => {
						if (err) reject(err);
					});
				resolve();
			})
	});
}

// updates a stock by adding prices to it
function updateStockInfo(symbol, pricesList, updateDate, timeframe) {
	return new Promise(async (resolve, reject) => {
		await ensureConnected();
		getCollection("prices" + timeframe)
			.then(async (collection) => {
				await collection.updateOne({
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
			})
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
				[key]: id
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
					[key]: id
				}
			});
		}

		resolve();
	});
}

module.exports = {
	createCollection,
	getCollection,
	addDocument,
	getDocument,
	setDocumentField,
	concatDocumentField,
	pushDocumentField,
	getDocumentField,
	deleteDocument,
	deleteCollection,
	containsID,
	setStockInfo,
	updateStockInfo,
	addActiveResult,
	deleteActiveResult
};