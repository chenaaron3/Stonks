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
gainSymbols = set()
lossSymbols = set()
netProfit = 0

eventList = []

# # start logging stats for each symbol
# for symbol in symbols:
#     # each symbol may have multiple golden cross events
#     events = data[symbol]["events"]    
#     for event in events:
#         # record profits
#         profit = event["profit"]
#         if profit > 0:
#             gains += profit
#             gainSymbols.add(symbol)
#             gainEvents.append(event)
#         else:
#             loss += profit
#             lossSymbols.add(symbol)
#             lossEvents.append(event)
#         netProfit += profit

#         # add to global event list
#         event["symbol"] = symbol
#         eventList.append(event)

for symbol in symbols:
    # record profits
    profit = data[symbol]["profit"]
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
        else:
            lossCount += 1

# general stats
print(f'Gains: {gains}, Loss: {loss}, Net: {netProfit}');
print(f'GainCount: {gainCount}, LossCount: {lossCount}, Ratio: {gainCount / lossCount}')

sortedEvents = open("./sortedEvents.json", "w")
json.dump(sorted(eventList, key=(lambda x: x["profit"])), sortedEvents)