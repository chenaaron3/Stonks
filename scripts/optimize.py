import json
import pandas as pd

PATH_TO_DATA = "../res/results15_50.json"
PRUNE = 10

# load results
data = json.load(open(PATH_TO_DATA, "r"))
symbols = list(data.keys())

keys = ["death", "rsi", "macd"]
results = {}
eventList = []
gainEvents = []
lossEvents = []

# start logging stats for each symbol
for symbol in symbols:
    # each symbol may have multiple golden cross events
    events = data[symbol]["events"]    
    for event in events:
        # record profits
        for key in keys:
            if (key + "Profit") in event:
                profit = event[key + "Profit"]
                if key not in results:
                    results[key] = { "gains": 0, "losses": 0, "profit": 0 }
                if profit > 0:
                    results[key]["gains"] += 1
                elif profit < 0:
                    results[key]["losses"] += 1
                results[key]["profit"] += profit
                
                if key == "rsi":
                    if profit > 0:
                        gainEvents.append(event)
                    elif profit < 0:
                        lossEvents.append(event)
        # add to global event list
        event["symbol"] = symbol
        eventList.append(event)

gainEvents = sorted(gainEvents, key=lambda x : -1 * x["rsiProfit"])
lossEvents = sorted(lossEvents, key=lambda x : x["rsiProfit"])

# general stats
for key in keys:
    print(f'{key}: Gains: {results[key]["gains"]}, Loss: {results[key]["losses"]}, Profit: {results[key]["profit"]}')

print("\nGains rsiMinMACD")
print(pd.Series(list([ event["rsiMinMACD"] for event in gainEvents ])[:50]).describe())
print("\nLoss rsiMinMACD")
print(pd.Series(list([ event["rsiMinMACD"] for event in lossEvents ])[:50]).describe())

sortedEvents = open("./sortedEvents.json", "w")
json.dump(sorted(eventList, key=(lambda x: x["rsiProfit"] if "rsiProfit" in x else 0)), sortedEvents)