let { isCrossed, getSimpleMovingAverage, getTrueRange } = require('../utils');
let Indicator = require('./indicator');

class Pullback extends Indicator {
    initialize(options) {
        this.period = options["period"]; // period of sma to check pullback
        this.length = options["length"]; // length of pullback check
        this.previousLength = 26;
        this.name = "Pullback";
        this.graph = this.calculate();
        this.atr = this.calculateATR();
    }

    calculate() {
        return getSimpleMovingAverage(this.dates, this.prices, this.period);
    }

    calculateATR() {
        // true range
        let tr = getTrueRange(this.dates, this.highs, this.lows, this.closes);
        let newDates = [...this.dates];
        newDates.shift();
        let atr = getSimpleMovingAverage(newDates, tr["data"], this.period);
        return atr;
    }

    getGraph() {
        return this.graph;
    }

    getValue(date) {
        return this.graph[date];
    }

    getAction(date, dateIndex) {
        let todayIndex = dateIndex;
        let yesterday = this.dates[todayIndex - 1];
        let todayPrice = this.prices[date];
        let yesterdayPrice = this.prices[yesterday];
        let todaySMA = this.graph[date];
        let yesterdaySMA = this.graph[yesterday];

        // if cross up sma
        if (isCrossed(yesterdayPrice, todayPrice, yesterdaySMA + this.atr[yesterday], todaySMA + this.atr[date], true)) {
            let firstDayIndex = Math.max(0, todayIndex - this.length);
            // check if cross down sma recently
            for (let i = firstDayIndex; i < todayIndex; ++i) {
                date = this.dates[i + 1];
                yesterday = this.dates[i];
                todayPrice = this.prices[date];
                yesterdayPrice = this.prices[yesterday];
                todaySMA = this.graph[date];
                yesterdaySMA = this.graph[yesterday];
                if (isCrossed(yesterdayPrice, todayPrice, yesterdaySMA + this.atr[yesterday], todaySMA + this.atr[date], false)) {
                    let buy = true;
                    for (let j = i - this.previousLength; j < i; ++j) {
                        let d = this.dates[j];
                        // if was not above SMA for long enough, or broke below area
                        if (this.prices[d] < this.graph[d] || this.prices[d] < this.graph[d] - this.atr[date] * .5) {
                            buy = false;
                            break;
                        }
                    }

                    if (buy) {
                        return Indicator.BUY;
                    }
                }
            }
        }
        return Indicator.NOACTION;
    }
}

module.exports = Pullback;