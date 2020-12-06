let { isCrossed, getExponentialMovingAverage, daysBetween } = require('../utils');
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
        let smoothedGraph = getExponentialMovingAverage(this.dates, this.prices, this.period)["data"];
        let previousPrice = smoothedGraph[this.dates[0]];
        let previousSlope = "P";
        let merged = {};
        let minIndex = 0;
        let maxIndex = 0;
        let sleep = 0;
        for (let i = 1; i < this.dates.length; ++i) {
            sleep -= 1;
            // console.log(i, "/", this.dates.length);
            let date = this.dates[i];
            let price = this.prices[date];
            let difference = smoothedGraph[date] - previousPrice;

            // keep track of min/max
            if (this.prices[this.dates[minIndex]] > price) {
                minIndex = i;
            }
            if (this.prices[this.dates[maxIndex]] < price) {
                maxIndex = i;
            }

            // if has a direction, check for possible reversal
            if (difference != 0) {
                let slope = difference > 0 ? "P" : "N";
                let level = undefined;
                // different slope
                if (previousSlope != slope) {
                    if (sleep <= 0) {
                        sleep = 7;
                        // if slope up, is support
                        if (slope == "P") {
                            level = { price: this.prices[this.dates[minIndex]], date: new Date(this.dates[minIndex]) };
                        }
                        // if slope down, is support
                        else if (slope == "N") {
                            level = { price: this.prices[this.dates[maxIndex]], date: new Date(this.dates[maxIndex]) };
                        }
                        this.pivots[level["date"].toISOString()] = level["price"];
                        minIndex = i;
                        maxIndex = i;
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
                        // newAverage = groupMatch;
                        let newSupport = merged[groupMatch]["support"] || slope == "P";
                        let newResistance = merged[groupMatch]["resistance"] || slope == "N";
                        delete merged[groupMatch];
                        merged[newAverage] = {
                            count: newCount, end: level["date"], start: oldStart,
                            support: newSupport, resistance: newResistance
                        };
                    }

                    // if not found, create a group
                    else {
                        merged[level["price"]] = {
                            count: 1, end: level["date"], start: level["date"],
                            support: slope == "P", resistance: slope == "N"
                        };
                    }
                }

                // each date has a copy of lines
                graph[date] = { ...merged };
                previousSlope = slope;
            }
            previousPrice = smoothedGraph[date];
        }
        return graph;
    }

    getGraph() {
        // return { pivots: this.pivots };

        // greatest level below price
        let support = {};
        // smallest level above price 
        let resistance = {};

        Object.keys(this.graph).forEach(date => {
            let relevantDate = new Date(date);
            relevantDate.setDate(relevantDate.getDate() - 360 * 2)
            let levels = Object.keys(this.graph[date]).filter(level => this.graph[date][level]["end"] >= relevantDate);            
            support[date] = Math.max(...levels.filter(level => level < this.prices[date]));
            resistance[date] = Math.min(...levels.filter(level => level > this.prices[date]));
        })

        return { support, resistance, pivots: this.pivots };
    }

    getValue(date) {
        return this.graph[date];
    }

    normalize(data) {
        return data;
    }

    getAction(date, dateIndex) {
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