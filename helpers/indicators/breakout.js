let { isCrossed, getSimpleMovingAverage, getTrueRange } = require('../utils');
let Indicator = require('./indicator');

class Breakout extends Indicator {
    initialize(options) {
        this.period = options["period"]; // period of sma to check breakout
        this.tests = options["tests"]; // min number of test on sma
        this.margin = 12; // min days between each test
        this.name = "Breakout";
        this.sma = this.calculateSMA();
        this.atr = this.calculateATR();

        this.testCount = 0;
        this.lastTest = 0;
    }

    calculateSMA() {
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

    getsma() {
        return this.sma;
    }

    getValue(date) {
        return this.sma[date];
    }

    entryMet(dateIndex) {
        let yesterday = this.dates[dateIndex - 1];
        let date = this.dates[dateIndex];
        let yesterdayHigh = this.highs[yesterday];
        let todayClose = this.closes[date];
        return todayClose > yesterdayHigh;
    }

    getAction(date, dateIndex, isMain) {
        let todayIndex = dateIndex;
        let yesterday = this.dates[todayIndex - 1];

        let todayPrice = this.prices[date];
        let yesterdayPrice = this.prices[yesterday];
        let todaySMA = this.sma[date];
        let yesterdaySMA = this.sma[yesterday];
        let offset = 0;

        this.lastTest -= 1;
        if (this.lastTest < 0) {
            // if cross down sma
            if (isCrossed(yesterdayPrice, todayPrice, yesterdaySMA + this.atr[yesterday] * offset, todaySMA + this.atr[date] * offset, false)) {
                let firstDayIndex = Math.max(0, todayIndex - 12); // 12 days for test
                // check if cross up sma recently
                for (let i = firstDayIndex; i < todayIndex; ++i) {
                    date = this.dates[i + 1];
                    yesterday = this.dates[i];
                    todayPrice = this.prices[date];
                    yesterdayPrice = this.prices[yesterday];
                    todaySMA = this.sma[date];
                    yesterdaySMA = this.sma[yesterday];

                    // cross up
                    if (isCrossed(yesterdayPrice, todayPrice, yesterdaySMA + this.atr[yesterday] * offset, todaySMA + this.atr[date] * offset, true)) {
                        this.testCount += 1;
                        this.lastTest = this.margin;
                    }
                }
            }
        }

        offset = 1;
        // cross ATR
        if (isCrossed(yesterdayPrice, todayPrice, yesterdaySMA + this.atr[yesterday] * offset, todaySMA + this.atr[date] * offset, true)) {
            // have enough tests to check breakout
            if (this.testCount >= this.tests) {
                return Indicator.BUY;
            }
            this.testCount = 0;
        }

        // above atr, reset tests
        if (todayPrice > todaySMA + this.atr[date] * offset) {
            this.testCount = 0;
        }

        return Indicator.NOACTION;
    }
}

module.exports = Breakout;