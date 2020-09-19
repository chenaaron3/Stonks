let { isCrossed, getExponentialMovingAverage, clampRange } = require('../utils');
let Indicator = require('./indicator');

class Structure extends Indicator {
    initialize(options) {
        this.period = options["period"];
        this.volatility = options["volatility"];
        this.minCount = options["minCount"];
        this.name = "Structure";
        this.graph = this.calculate();
    }

    calculate() {
        let graph = {};
        let smoothedGraph = getExponentialMovingAverage(this.dates, this.prices, this.period)["data"];
        let previousPrice = smoothedGraph[this.dates[0]];
        let previousSlope = "P";
        let merged = {};
        for (let i = 1; i < this.dates.length; ++i) {
            // console.log(i, "/", this.dates.length);
            let date = this.dates[i];
            let difference = smoothedGraph[date] - previousPrice;
            // if has a direction, check for possible reversal
            if (difference != 0) {
                let slope = difference > 0 ? "P" : "N";
                let level = undefined;
                // different slope
                if (previousSlope != slope) {
                    // if slope up, is support
                    if (slope == "P") {
                        // look for local min
                        let minIndex = i;
                        while (minIndex > 1) {
                            if (this.prices[this.dates[minIndex - 1]] > this.prices[this.dates[minIndex]]) break;
                            minIndex--;
                        }
                        level = { price: this.prices[this.dates[minIndex]], date: new Date(this.dates[minIndex]) };
                    }
                    // if slope down, is support
                    else if (slope == "N") {
                        // look for local max
                        let maxIndex = i;
                        while (maxIndex > 1) {
                            if (this.prices[this.dates[maxIndex - 1]] < this.prices[this.dates[maxIndex]]) break;
                            maxIndex--;
                        }
                        level = { price: this.prices[this.dates[maxIndex]], date: new Date(this.dates[maxIndex]) };
                    }
                }

                if (level) {
                    let groupMatch = undefined;
                    let groupAverages = Object.keys(merged);
                    // look for a group that is close to this level
                    for (let i = 0; i < groupAverages.length; ++i) {
                        let groupAverage = groupAverages[i];
                        if (groupAverage * (1 + this.volatility) > level["price"] && groupAverage * (1 - this.volatility) < level["price"]) {
                            groupMatch = groupAverage;
                            break;
                        }
                    }
                    // if found a group, add to group
                    if (groupMatch) {
                        let oldStart = merged[groupMatch]["start"];
                        let oldCount = merged[groupMatch]["count"];
                        let newCount = oldCount + 1;
                        let newAverage = (groupMatch * oldCount + level["price"]) / newCount;
                        delete merged[groupMatch];
                        merged[newAverage] = { count: newCount, end: level["date"], start: oldStart };
                    }
                    // if not found, create a group
                    else {
                        merged[level["price"]] = { count: 1, end: level["date"], start: level["date"] };
                    }
                }

                graph[date] = { ...merged };
                previousSlope = slope;
            }
            previousPrice = smoothedGraph[date];
        }
        return graph;
    }

    getGraph() {
        // greatest level below price
        let support = {};
        // smallest level above price 
        let resistance = {};

        Object.keys(this.graph).forEach(date => {
            let price = this.prices[date];
            let min = undefined;
            let max = undefined;
            Object.keys(this.graph[date]).forEach(level => {
                // potential max
                if (level < price) {
                    if (max) {
                        max = Math.max(max, level);
                    }
                    else {
                        max = level;
                    }
                }
                // potential min
                else if (level > price) {
                    if (min) {
                        min = Math.min(min, level);
                    }
                    else {
                        min = level;
                    }
                }
            });
            support[date] = max;
            resistance[date] = min;
        })

        return { support, resistance };
    }

    getValue(date) {
        return this.graph[date];
    }

    normalize(data) {
        return data;
    }

    getAction(date) {
        let todayIndex = this.dates.indexOf(date);
        let yesterdayIndex = todayIndex - 1;
        let yesterday = this.dates[yesterdayIndex];

        // Buy if candle crossed any major structure yesterday and close above today
        let levels;//.filter(level => this.graph[date][level]["start"] <= date && this.graph[date][level]["end"] >= date);
        if (this.graph.hasOwnProperty(date)) {
            levels = Object.keys(this.graph[date]);
        }
        else {
            return Indicator.NOACTION
        }
        let bodyCrossUp = levels.find(level => isCrossed(this.opens[yesterday], this.closes[yesterday], level, level, true) && this.graph[date][level]["count"] > this.minCount);
        let bodyCrossDown = levels.find(level => isCrossed(this.opens[yesterday], this.closes[yesterday], level, level, false));

        // find an upper level in case there is no upper limit
        let upperLevel = levels.find(level => level > this.prices[date]);
        let lowerLevel = levels.find(level => level < this.prices[date]);
        let limitReached = false;
        if (!upperLevel && this.limitLevel) {
            limitReached = isCrossed(this.prices[yesterday], this.prices[date], this.limitLevel, this.limitLevel, true)
        }
        
        // buy if crossed a previous structure level
        if (bodyCrossUp && this.prices[yesterday] < this.prices[date]) {
            if (lowerLevel) {
                this.limitLevel = this.prices[date] + ( this.prices[date] - lowerLevel);
            }
            return Indicator.BUY;
        }
        else if ((bodyCrossDown && this.prices[yesterday] > this.prices[date]) || limitReached) {
            return Indicator.SELL;
        }
        else {
            return Indicator.NOACTION;
        }
    }
}

module.exports = Structure;