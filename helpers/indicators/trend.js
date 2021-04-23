const { LongWithoutOverridesClass } = require('bson');
let { getSwingPivots, getTrueRange, getSimpleMovingAverage, inRange, isHighLow, isCrossed } = require('../utils');
let Indicator = require('./indicator');

class Trend extends Indicator {
    initialize(options) {
        this.period = options["period"];
        this.lookback = options["lookback"]; // look back on up to x lows
        this.name = "Trend";
        this.graph = this.calculate();
    }

    calculate() {
        let pivots = getSwingPivots(this.dates, this.prices, this.period);
        let pivotDates = Object.keys(pivots).sort();

        // maps daily dates to realized pivot points
        let realizedPivots = {};
        // the date to realize next
        let realizeIndex = 0;
        for (let i = 0; i < this.dates.length; ++i) {
            // if realized all the dates already
            if (realizeIndex >= pivotDates.length) {
                realizedPivots[this.dates[i]] = pivotDates.length - 1;
                continue;
            }

            // if we just realized a date
            if (this.dates[i] >= pivots[pivotDates[realizeIndex]]["realized"]) {
                realizeIndex += 1;
            }

            // record the latest realized pivot
            realizedPivots[this.dates[i]] = realizeIndex - 1;
        }

        this.pivots = pivots;
        this.pivotDates = pivotDates;

        let tr = getTrueRange(this.dates, this.highs, this.lows, this.closes);
        this.atr = getSimpleMovingAverage(this.dates, tr["data"], this.period);

        return realizedPivots;
    }

    getGraph() {
        return { pivots: this.pivots, pivotDates: this.pivotDates, realizedPivots: this.graph };
    }

    getValue(date) {
        return this.graph[date];
    }

    normalize(data) {
        return data;
    }

    getAction(date, dateIndex, isMain) {
        let yesterdayPrice = this.prices[this.dates[dateIndex - 1]];
        let price = this.prices[date];
        let realizedIndex = this.graph[date];
        let highCursor = realizedIndex;

        // fresh stock, have not realized any pivots
        if (realizedIndex < 0) {
            return Indicator.NOACTION;
        }

        // if low already realized, its too late
        if (this.pivots[this.pivotDates[realizedIndex]]["type"] == "low") {
            return Indicator.NOACTION;
        }

        // decrement by 2 to skip high
        let lookbackCount = this.lookback;
        for (; highCursor >= 4 && lookbackCount > 0; highCursor -= 2) {
            let highDate = this.pivotDates[highCursor - 2];
            let highAtr = this.atr[highDate];

            // if (inRange(price, this.prices[highDate], highAtr / 2) // if pullback to previous high
            //     && isHighLow(this.dates, this.prices, this.period, dateIndex)["low"]) { // if is a low
            //     return Indicator.BUY;
            // }

            // if cross out of zone
            let upperZone = this.prices[highDate] + highAtr / 2;
            let lowerZone = this.prices[highDate] - highAtr / 2
            // exited zone, potential growth
            if (isCrossed(yesterdayPrice, price, upperZone, upperZone, true)) {
                let crossedDown = false;
                let brokenZone = false;
                let firstDayIndex = Math.max(0, dateIndex - 5);
                for (let i = firstDayIndex; i < dateIndex; ++i) {
                    // entered zone recently
                    if (!crossedDown && isCrossed(this.prices[this.dates[i - 1]], this.prices[this.dates[i]], upperZone, upperZone, false)) {
                        crossedDown = true;
                    }
                    // went out of zone in between
                    if (!brokenZone && isCrossed(this.prices[this.dates[i - 1]], this.prices[this.dates[i]], lowerZone, lowerZone, false)) {
                        brokenZone = true;
                        break;
                    }
                }
                if (crossedDown && !brokenZone) {
                    return Indicator.BUY;
                }
            }

            // reduce number of lookbacks
            --lookbackCount;
        }

        return Indicator.NOACTION;
    }
}

module.exports = Trend;