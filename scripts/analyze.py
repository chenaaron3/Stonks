import json
import pandas as pd

PATH_TO_DATA = "../res/resultsProfit.json"
PRUNE = 10

# load results
data = json.load(open(PATH_TO_DATA, "r"))
symbols = list(data.keys())

# record statistics
gains = 0
gainCount = 0
loss = 0
lossCount = 0
netProfit = 0
netPercentProfit = 0
count = 0

eventList = []
gainEvents = []
lossEvents = []

# # start logging stats for each symbol
for symbol in symbols:
    # record profits
    profit = data[symbol]["profit"]
    if data[symbol]["percentProfit"]:
        netPercentProfit += data[symbol]["percentProfit"]
        count += 1

    if profit > 0:
        gains += profit
    else:
        loss += profit
    netProfit += profit
    events = data[symbol]["events"]    
    for event in events:
        event["symbol"] = symbol
        eventList.append(event)
        if (event["profit"] > 0):
            gainCount += 1
            gainEvents.append(event)
        else:
            lossCount += 1
            lossEvents.append(event)

print("\nGains Span")
print(pd.Series([ event["span"] for event in gainEvents ]).describe())
print("\nLoss Span")
print(pd.Series([ event["span"] for event in lossEvents ]).describe())

# general stats
print(f'Gains: {gains}, Loss: {loss}, Net: {netProfit}, %Net: {netPercentProfit / count}')
print(f'GainCount: {gainCount}, LossCount: {lossCount}, Ratio: {gainCount / lossCount}')

sortedEvents = open("./sortedEvents.json", "w")
json.dump(sorted(eventList, key=(lambda x: x["percentProfit"])), sortedEvents)