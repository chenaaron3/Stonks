import { MongoClient, Db, Collection } from 'mongodb';
import bson from 'bson';

import { GenericObject, MongoDocumentData, MongoFragmentData, MongoSplitOptions, COLLECTION_NAMES, ActiveResultData } from '../types/types';
import { Timeframe, BarData } from '@shared/common';
import { Exchange } from '@alpacahq/alpaca-trade-api';

const DOC_LIMIT = 10000000;

let stonks: Db;
let resultsCollection: Collection;

let mongoURL = process.env.MONGO_DATABASE_URL

const client = new MongoClient(mongoURL, {});

// ensure that there is a valid connection
function ensureConnected() {
	return new Promise<void>(resolve => {
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
				let collectionNames: string[] = [];
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
				if (!collectionNames.includes("prices1Hour")) {
					await stonks.createCollection("prices1Hour");
				}
				if (!collectionNames.includes("prices1Day")) {
					await stonks.createCollection("prices1Day");
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
function getCollection<T extends MongoDocumentData>(collectionName: COLLECTION_NAMES) {
	return new Promise<Collection<T>>(async (resolve, reject) => {
		await ensureConnected();
		// check if collection exists
		stonks.listCollections({ name: collectionName })
			.next(function (err, collection) {
				if (err) reject(err);
				if (collection) {
					resolve(stonks.collection<T>(collectionName));
				}
				else {
					reject(`Collection ${collectionName} does not exist!`);
				}
			});
	});
}

function createCollection(collectionName: string) {
	return new Promise<void>(async (resolve, reject) => {
		await ensureConnected();
		try {
			await stonks.createCollection(collectionName);
		}
		catch (e) {
			console.log(`Collection ${collectionName} already exists!`);
		}
		resolve();
	});
}

function addDocument(collectionName: COLLECTION_NAMES, document: MongoDocumentData) {
	return new Promise<void>(async (resolve, reject) => {
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
function getDocument<T extends MongoDocumentData>(collectionName: COLLECTION_NAMES, documentID: string) {
	return new Promise<T | undefined>(async (resolve, reject) => {
		await ensureConnected();
		// get collection
		getCollection<T>(collectionName)
			.then(async (collection) => {
				// get document
				let results = collection.find({
					"_id": documentID
				} as any);
				let documents = await results.toArray();
				if (documents.length > 0) {
					// check if fragmented
					let doc = documents[0];
					if (doc.hasOwnProperty("_fragmentData")) {
						let fragmentData = doc["_fragmentData"]!;
						let options = fragmentData["options"];
						let data: Object | any[];

						// fetch all fragments
						let promises = fragmentData["ids"].map(fragmentID => getDocument<T>(collectionName, fragmentID));
						let fragments = await Promise.all(promises);

						// check reconstruction method
						if (fragmentData["type"] == "array") {
							data = [];
							fragments.forEach(f => {
								data = (data as any[]).concat(f!["fragment"]);
							})
						}
						else {
							data = {};
							fragments.forEach(f => {
								Object.assign(data, f!["fragment"]);
							})
						}

						// apply reconstructed data to doc
						if (options["subField"]) {
							doc[fragmentData["field"]][options["subField"]] = data;
						}
						else {
							Object.assign(doc, { [fragmentData['field']]: data });
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

function deleteCollection(collectionName: COLLECTION_NAMES) {
	return new Promise<void>(async (resolve, reject) => {
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

function deleteDocument(collectionName: COLLECTION_NAMES, documentID: string) {
	return new Promise<void>(async (resolve, reject) => {
		await ensureConnected();
		// get collection
		getCollection(collectionName)
			.then(async (collection) => {
				// get document to check for fragments
				let frag = await getDocumentField(collectionName, documentID, ["_fragmentData"]) as { _fragmentData?: MongoFragmentData };
				if (frag && frag.hasOwnProperty("_fragmentData")) {
					// delete doc's fragments first
					for (let i = 0; i < frag["_fragmentData"]!["ids"].length; ++i) {
						let fragID = frag["_fragmentData"]!["ids"][i];
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
function containsID(collectionName: COLLECTION_NAMES, id: string) {
	return new Promise<boolean>(async (resolve, reject) => {
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
function pushDocumentField(collectionName: COLLECTION_NAMES, id: string, fieldName: string, value: string) {
	return new Promise<void>(async (resolve, reject) => {
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

// concat array to an array
function concatDocumentField(collectionName: COLLECTION_NAMES, id: string, fieldName: string, value: any) {
	return new Promise<void>(async (resolve, reject) => {
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

function setDocumentField(collectionName: COLLECTION_NAMES, id: string, fieldName: string, value: any, splitOptions: MongoSplitOptions | undefined) {
	return new Promise<void>(async (resolve, reject) => {
		await ensureConnected();
		getCollection(collectionName)
			.then(async (collection) => {
				collection.updateOne({
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
							let doc = await getDocumentField(collectionName, id, ["_fragmentData"]) as { _fragmentData?: MongoFragmentData };
							// clear fragment data because it fits now
							if (doc && doc["_fragmentData"] && doc["_fragmentData"]["field"] == fieldName) {
								await setDocumentField(collectionName, id, "_fragmentData", undefined, undefined);
							}
							resolve();
						}
					});
			})
	});
}

async function getDocumentField<T extends MongoDocumentData>(collectionName: COLLECTION_NAMES, id: string, fieldNames: string[]) {
	return new Promise<T | undefined>(async (resolve, reject) => {
		await ensureConnected();
		getCollection<T>(collectionName)
			.then(async (collection) => {
				// construct projection object
				let projection: { [key: string]: true } = {};
				fieldNames.forEach(fn => projection[fn] = true)
				let results = collection.find({
					"_id": id
				} as any).project(projection);

				// TODO if field is fragmented, need to reconstruct

				// cursor to object
				let array = await results.toArray();
				if (array.length > 0) {
					resolve(array[0] as T);
				}
				else {
					resolve(undefined);
				}
			})
	});
}

// helper method to split large documents
async function splitField(collectionName: COLLECTION_NAMES, id: string, fieldName: string, value: any, splitOptions: MongoSplitOptions | undefined) {
	return new Promise<void>(async (resolve, reject) => {
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
			let fragmentData: MongoFragmentData = {
				field: fieldName,
				options: splitOptions,
				type: 'object',
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
					let dict: GenericObject = {};
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
			let previousFragments = await getDocumentField(collectionName, id, ["_fragmentData"]) as { _fragmentData?: MongoFragmentData };
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
			await setDocumentField(collectionName, id, fieldName, value, undefined);
			// cache fragment data
			await setDocumentField(collectionName, id, "_fragmentData", fragmentData, undefined);

			console.log(fragmentData)
			resolve();
		}
		else {
			reject("Can only split Objects or Arrays");
		}
	})
}

// rewrite a stock's price history
function setStockInfo(symbol: string, pricesList: BarData[], updateDate: Date, timeframe: Timeframe) {
	return new Promise<void>(async (resolve, reject) => {
		await ensureConnected();
		getCollection(("prices" + timeframe) as COLLECTION_NAMES)
			.then(async (collection) => {
				collection.updateOne({
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
function updateStockInfo(symbol: string, pricesList: BarData[], updateDate: Date, timeframe: Timeframe) {
	return new Promise<void>(async (resolve, reject) => {
		await ensureConnected();
		getCollection(("prices" + timeframe) as COLLECTION_NAMES)
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

function addActiveResult(id: ActiveResultData) {
	return new Promise<void>(async (resolve, reject) => {
		await ensureConnected();
		getCollection('metadata')
			.then(async (collection) => {
				let key = "activeResults";
				// add document if doesnt exist
				if ((await collection.find({ _id: key }).count()) == 0) {
					await addDocument('metadata', { _id: key, [key]: [] });
				}

				await collection.updateOne({
					"_id": key
				}, {
					$addToSet: {
						[key]: id
					}
				}, {
					upsert: true
				});
				resolve();
			})
	});
}

function deleteActiveResult(id: ActiveResultData) {
	return new Promise<void>(async (resolve, reject) => {
		await ensureConnected();
		getCollection('metadata')
			.then(async (collection) => {
				let key = "activeResults";
				if ((await collection.find({ _id: key }).count()) != 0) {
					await collection.updateOne({
						"_id": key
					}, {
						$pull: {
							[key]: id
						}
					});
				}

				resolve();
			})
	});
}

export {
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