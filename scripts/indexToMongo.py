# Import skeleton documents to mongo

import pymongo
from pathlib import Path
from dotenv import load_dotenv
import os
import json

env_path = Path('../.env')
load_dotenv(dotenv_path=env_path)

client = pymongo.MongoClient(os.environ.get('MONGO_DATABASE_URL'))
print("Connected to Mongo!")

db = client['stonks']
prices = db['prices']

# with open('../res/priceCache.json') as data_file:
# 	data = json.load(data_file)
# 	for symbol in data:
# 		dictIndex = {}
# 		dictIndex["_id"] = symbol
# 		dictIndex["prices"] = data[symbol]
# 		dictIndex["lastUpdated"] = data[symbol][-1]['date']
# 		if prices.count_documents({"_id":symbol}) == 0:
# 			prices.insert_one(dictIndex)

# update all symbols
with open('../res/symbols.json') as data_file:
	data = json.load(data_file)
	for symbol in data:
		if symbol.count(".") or symbol.count("^"):
			continue
		print(f"Indexing {symbol}")
		dictIndex = {}
		dictIndex["_id"] = symbol
		dictIndex["prices"] = []
		dictIndex["lastUpdated"] = "1990-01-01T00:00:00.000Z"
		if prices.count_documents({"_id":symbol}) == 0:
			prices.insert_one(dictIndex)
