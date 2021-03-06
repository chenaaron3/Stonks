let { isCrossed, getSwingPivots, getRSI, getTrueRange, getSimpleMovingAverage, isHighLow } = require('../utils');
let Indicator = require('./indicator');

class Divergence extends Indicator {
    initialize(options) {
        this.period = options["period"];
        this.lookback = options["lookback"]; // look back on up to x lows
        this.maxRSI = 35;
        this.minATR = 0;
        this.signalOnRealize = false;
        this.name = "Divergence";
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
        this.rsi = getRSI(this.dates, this.prices, 14);

        let tr = getTrueRange(this.dates, this.highs, this.lows, this.closes);
        this.atr = getSimpleMovingAverage(this.dates, tr["data"], this.period);

        return realizedPivots;
    }

    getGraph() {
        let debug = {};
        for (let i = 0; i < this.dates.length; ++i) {
            let date = this.dates[i];
            debug[date] = this.prices[this.pivotDates[this.graph[date]]];
        }
        return { pivots: this.pivots, Divergence: debug };
    }

    getValue(date) {
        return this.graph[date];
    }

    normalize(data) {
        return data;
    }

    getAction(date, dateIndex, isMain) {
        let price = this.prices[date];
        let rsi = this.rsi[date];
        let realizedIndex = this.graph[date];
        let lowCursor = realizedIndex;

        // fresh stock, have not realized any pivots
        if (realizedIndex < 0) {
            return Indicator.NOACTION;
        }
        // move cursor to most recent low
        else {
            // look for lows not highs
            if (this.pivots[this.pivotDates[realizedIndex]]["type"] == "high") {
                lowCursor -= 1;
            }
        }

        // decrement by 2 to skip high
        let lookbackCount = this.lookback;
        for (; lowCursor >= 2 && lookbackCount > 0; lowCursor -= 2) {
            let lowDate = this.pivotDates[lowCursor];

            // signal when realize a low (need low period)
            if (this.signalOnRealize) {
                let prevLowDate = this.pivotDates[lowCursor - 2];
                if (date == this.pivots[lowDate]["realized"] // when realized
                    && this.prices[prevLowDate] < this.prices[lowDate] // if higher low on price
                    && this.rsi[prevLowDate] > this.rsi[lowDate]) { // if lower low on rsi
                    return Indicator.BUY
                }
            }
            // signal on all lows
            else {
                if (price > this.prices[lowDate] + this.atr[lowDate] * this.minATR // if higher low on price
                    && rsi < this.rsi[lowDate] // if lower low on rsi
                    && rsi < this.maxRSI
                    && isHighLow(this.dates, this.prices, this.period, dateIndex)["low"]) { // if is a low
                    return Indicator.BUY;
                }
            }

            // reduce number of lookbacks
            --lookbackCount;
        }

        return Indicator.NOACTION;
    }
}

module.exports = Divergence;