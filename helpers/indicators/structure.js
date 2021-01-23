let { isCrossed, getExponentialMovingAverage, daysBetween, getSwingPivots } = require('../utils');
let Indicator = require('./indicator');

class Structure extends Indicator {
    initialize(options) {
        this.period = options["period"];
        this.volatility = options["volatility"];
        this.minCount = options["minCount"];
        this.name = "Structure";
        this.pivots = {};
        this.graph = this.calculate();
    }

    calculate() {
        let graph = {};
        let pivots = getSwingPivots(this.dates, this.prices, this.period);
        this.pivots = pivots;
        let realizedPivots = {}
        let keys = Object.keys(pivots);
        for (let i = 0; i < keys.length; ++i) {
            let pivotDate = keys[i];
            let pivot = pivots[pivotDate];
            pivot["date"] = pivotDate;
            realizedPivots[pivot["realized"]] = pivot; 
        }

        let merged = {};
        for (let i = 0; i < this.dates.length; ++i) {
            let date = this.dates[i];
            let price = this.prices[date];

            // is a pivot, update merged dict
            if (realizedPivots.hasOwnProperty(date)) {
                let pivot = realizedPivots[date];
                let groupMatch = undefined;
                let groupAverages = Object.keys(merged);

                // look for a group that is close to this pivot
                for (let i = 0; i < groupAverages.length; ++i) {
                    let groupAverage = groupAverages[i];
                    if (groupAverage * (1 + this.volatility) > pivot["price"] && groupAverage * (1 - this.volatility) < pivot["price"]) {
                        groupMatch = groupAverage;
                        break;
                    }
                }

                // if found a group, add to group
                if (groupMatch) {
                    let oldStart = merged[groupMatch]["start"];
                    let oldCount = merged[groupMatch]["count"];
                    let newCount = oldCount + 1;
                    let newAverage = (groupMatch * oldCount + pivot["price"]) / newCount;
                    let newSupport = merged[groupMatch]["support"] || pivot["type"] == "low";
                    let newResistance = merged[groupMatch]["resistance"] || pivot["type"] == "high";
                    delete merged[groupMatch];
                    merged[newAverage] = {
                        count: newCount, end: pivot["date"], start: oldStart,
                        support: newSupport, resistance: newResistance,
                        freshness: 720
                    };
                }
                // if not found, create a group
                else {
                    merged[pivot["price"]] = {
                        count: 1, end: price["date"], start: price["date"],
                        support: pivot["type"] == "low", resistance: pivot["type"] == "high", 
                        freshness: 720
                    };
                }
            }

            // trim merge dict of irrelevant levels
            keys = Object.keys(merged);
            for(let i = 0; i < keys.length; ++i) {
                let key = keys[i];
                merged[key]["freshness"] -= 1;
                if (merged[key]["freshness"] <= 0) {
                    delete merged[key];
                }
            }

            let levels = Object.keys(merged);
            graph[date] = {
                support: Math.max(...levels.filter(level => level < price)),
                resistance: Math.min(...levels.filter(level => level > this.prices[date]))
            }
        }
        return graph;
    }

    getGraph() {
        // greatest level below price
        let support = {};
        // smallest level above price 
        let resistance = {};

        // transform data
        Object.keys(this.graph).forEach(date => {
            support[date] = this.graph[date]["support"];
            resistance[date] = this.graph[date]["resistance"];
        })

        return { support, resistance, pivots: this.pivots };
    }

    getValue(date) {
        return this.graph[date];
    }

    normalize(data) {
        return data;
    }

    getAction(date, dateIndex, isMain) {
        let todayIndex = dateIndex;
        let yesterday = this.dates[todayIndex - 1];
        let beforeYesterday = this.dates[todayIndex - 2];

        // Buy if candle crossed any major structure yesterday and close above today
        let levels;
        if (this.graph.hasOwnProperty(date)) {
            let relevantDate = new Date(date);
            relevantDate.setDate(relevantDate.getDate() - 720)
            levels = Object.keys(this.graph[date]).filter(level => this.graph[date][level]["end"] >= relevantDate);
        }
        else {
            return Indicator.NOACTION
        }

        // price crosses
        let yesterdayBodyCrossUp = levels.find(level => isCrossed(this.prices[beforeYesterday], this.prices[yesterday], level, level, true)); // && this.graph[date][level]["count"] > this.minCount
        let yetserdayBodyCrossDown = levels.find(level => isCrossed(this.prices[beforeYesterday], this.prices[yesterday], level, level, false));
        let todayBodyCrossUp = levels.find(level => isCrossed(this.prices[yesterday], this.prices[date], level, level, true));
        let todayBodyCrossDown = levels.find(level => isCrossed(this.prices[yesterday], this.prices[date], level, level, false));

        // find an upper level in case there is no upper limit
        let upperLevel = Math.min(...levels.filter(level => level > this.prices[date]));
        let lowerLevel = Math.max(...levels.filter(level => level < this.prices[date]));
        let limitReached = false;
        if (!upperLevel && this.limitLevel) {
            limitReached = isCrossed(this.prices[yesterday], this.prices[date], this.limitLevel, this.limitLevel, true)
        }

        // if today cross new level, sell
        if (todayBodyCrossUp) {
            return Indicator.SELL;
        }

        // if yesterday cross and today still above level
        if (yesterdayBodyCrossUp && this.prices[date] > yesterdayBodyCrossUp) {
            // make sure not already too high
            if (upperLevel && this.prices[date] > (upperLevel + lowerLevel) / 2) {
                return Indicator.NOACTION;
            }
            // track limit
            if (lowerLevel) {
                this.limitLevel = this.prices[date] + (this.prices[date] - lowerLevel);
            }
            return Indicator.BUY;
        }
        else if ((yetserdayBodyCrossDown && this.prices[yesterday] > this.prices[date]) || limitReached) {
            return Indicator.SELL;
        }
        else {
            return Indicator.NOACTION;
        }
    }
}

module.exports = Structure;