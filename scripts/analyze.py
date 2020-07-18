import json
import pandas as pd

PATH_TO_DATA = "../res/results15_50.json"
PRUNE = 10

# load results
data = json.load(open(PATH_TO_DATA, "r"))
symbols = list(data.keys())

# record statistics
gains = 0
loss = 0
gainSymbols = set()
lossSymbols = set()
netProfit = 0

# lists
eventList = []
gainEvents = []
lossEvents = []
testList = []

# start logging stats for each symbol
for symbol in symbols:
    # each symbol may have multiple golden cross events
    events = data[symbol]["events"]    
    for event in events:
        # record profits
        profit = event["profit"]
        if profit > 0:
            gains += profit
            gainSymbols.add(symbol)
            gainEvents.append(event)
        else:
            loss += profit
            lossSymbols.add(symbol)
            lossEvents.append(event)
        netProfit += profit

        # add to global event list
        event["symbol"] = symbol
        eventList.append(event)

# top 50 profits
gainEvents = sorted(gainEvents, key=((lambda x: -1 * x["profit"])))[:PRUNE]
# top 50 losses
lossEvents = sorted(lossEvents, key=((lambda x: x["profit"])))[:PRUNE]

# macd stats
print("\nGains goldenMACD")
print(pd.Series([ event["goldenMACD"] for event in gainEvents ]).describe())
print("\nLoss goldenMACD")
print(pd.Series([ event["goldenMACD"] for event in lossEvents ]).describe())

print("\nGains deathMACD")
print(pd.Series([ event["deathMACD"] for event in gainEvents ]).describe())
print("\nLoss deathMACD")
print(pd.Series([ event["deathMACD"] for event in lossEvents ]).describe())

# rsi stats
print("\nGains goldenRSI")
print(pd.Series([ event["goldenRSI"] for event in gainEvents ]).describe())
print("\nLoss goldenRSI")
print(pd.Series([ event["goldenRSI"] for event in lossEvents ]).describe())

print("\nGains deathRSI")
print(pd.Series([ event["deathRSI"] for event in gainEvents ]).describe())
print("\nLoss deathRSI")
print(pd.Series([ event["deathRSI"] for event in lossEvents ]).describe())

# profit stats
print("\nGains Profit")
print(pd.Series([ event["profit"] for event in gainEvents ]).describe())
print("\nLoss Profit")
print(pd.Series([ event["profit"] for event in lossEvents ]).describe())

# general stats
print(f'Gains: {gains}, Loss: {loss}, Net: {netProfit}')

testList = [ event for event in eventList if (event["goldenMACD"] < 3 and event["deathMACD"] > -1) ]
print(f"Test Profit({len(testList)}):", sum([ event["profit"] for event in testList ]))
print(f"Test Ratio:", len([_ for _ in testList if _["profit"] > 0]) / len([_ for _ in testList if _["profit"] < 0])) 

sortedEvents = open("./sortedEvents.json", "w")
json.dump(sorted(eventList, key=(lambda x: x["profit"])), sortedEvents)