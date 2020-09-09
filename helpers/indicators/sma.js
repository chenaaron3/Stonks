let { isCrossed, getSimpleMovingAverage, clampRange } = require('../utils');
let Indicator = require('./indicator');

class SMA extends Indicator {
    initialize(options) {
        this.period = options["period"];
        this.minDuration = options["minDuration"];
        this.strict = false;
        this.name = "SMA";
        this.graph = this.calculate();
    }

    calculate() {
        return getSimpleMovingAverage(this.dates, this.prices, this.period);
    }

    getGraph() {
        return { [`SMA(${this.period})`]: this.graph };
    }

    getValue(date) {
        return this.graph[date];
    }

    normalize(data) {
        return clampRange(data);
    }

    getAction(date) {
        let todayIndex = this.dates.indexOf(date);
        let firstDayIndex = Math.max(1, todayIndex - this.minDuration + 1);
        let buy = true;

        let yesterday = this.dates[todayIndex - 1];
        let yesterdayPrice = this.prices[yesterday];
        let todayPrice = this.prices[date];
        let yesterdaySMA = this.graph[yesterday];
        let todaySMA = this.graph[date];

        // check consecutive days
        for (let i = firstDayIndex; i <= todayIndex; ++i) {
            yesterday = this.dates[i - 1];
            let today = this.dates[i];
            todayPrice = this.prices[today];
            yesterdaySMA = this.graph[yesterday];
            todaySMA = this.graph[today];

            // price < SMA, or SMA slope down violates
            if (todayPrice < todaySMA || (this.strict && todaySMA < yesterdaySMA)) {
                buy = false;
            }
        }

        let isCrossedDown = isCrossed(yesterdayPrice, todayPrice, yesterdaySMA, todaySMA, false);
        if (buy) {
            return Indicator.BUY;
        }
        else if (isCrossedDown) {
            return Indicator.SELL;
        }
        else {
            return Indicator.NOACTION;
        }
    }

    shouldStop(date) {
        let todayIndex = this.dates.indexOf(date);
        let firstDayIndex = Math.max(1, todayIndex - this.minDuration + 1);
        let stop = true;

        // check consecutive days
        for (let i = firstDayIndex; i <= todayIndex; ++i) {
            let yesterday = this.dates[i - 1];
            let today = this.dates[i];

            let yesterdayPrice = this.prices[yesterday];
            let todayPrice = this.prices[today];
            let todaySMA = this.graph[today];
            let todayHigh = this.highs[today];

            // 3 day in a row where high < SMA and price descending
            if (!(todaySMA > todayHigh && todayPrice < yesterdayPrice)) {
                stop = false;
            }
        }

        if (stop) {
            return Indicator.STOP;
        }
        else {
            return Indicator.NOACTION;
        }
    }
}

module.exports = SMA;