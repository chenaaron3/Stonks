let { isCrossed, getSimpleMovingAverage, getTrueRange, daysBetween } = require('../utils');
let Indicator = require('./indicator');

class Pullback extends Indicator {
    initialize(options) {
        this.period = options["period"]; // period of sma to check pullback
        this.length = options["length"]; // length of pullback check
        this.previousLength = 26;
        this.expiration = 3;
        this.name = "Pullback";
        this.graph = this.calculate();
        this.atr = this.calculateATR();

        this.conditions = false;
        this.freshness = this.expiration;
        this.lastBuy = undefined;
        this.buyChain = 0;
    }

    calculate() {
        return getSimpleMovingAverage(this.dates, this.prices, this.period);
    }

    calculateATR() {
        // true range
        let tr = getTrueRange(this.dates, this.highs, this.lows, this.closes);
        let newDates = [...this.dates];
        newDates.shift();
        let atr = getSimpleMovingAverage(newDates, tr["data"], 12);
        return atr;
    }

    getGraph() {
        return this.graph;
    }

    getValue(date) {
        return this.graph[date];
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

        // pullback conditions not met yet
        if (!this.conditions || true) {
            let todayPrice = this.prices[date];
            let yesterdayPrice = this.prices[yesterday];
            let todaySMA = this.graph[date];
            let yesterdaySMA = this.graph[yesterday];
            let firstDayIndex = Math.max(0, todayIndex - this.length);
            let offset = 1;

            // if yesterday lows cross below threshold
            // if (isCrossed(this.lows[yesterday], Math.min(yesterdayPrice, this.opens[yesterday]),
            //     yesterdaySMA + this.atr[yesterday] * offset, yesterdaySMA + this.atr[yesterday] * offset, true)) {
            //     // if today lows above threshold and price going up and price less than max threshold
            //     if (this.lows[date] > todaySMA + this.atr[date] * offset && todayPrice > yesterdayPrice && todayPrice < todaySMA + 2 * this.atr[date]) {
            //         let buy = true;

            //         // check if days before dip is above threshold
            //         for (let i = todayIndex - 1; i >= Math.max(0, todayIndex - this.previousLength); --i) {
            //             let d = this.dates[i];

            //             // price below threshold
            //             if (this.prices[d] < this.graph[d] + this.atr[d] * offset) {
            //                 buy = false;
            //                 break;
            //             }
            //         }

            //         if (buy) {
            //             return Indicator.BUY;
            //         }
            //     }
            // }

            // if cross up sma
            if (isCrossed(yesterdayPrice, todayPrice, yesterdaySMA + this.atr[yesterday] * offset, todaySMA + this.atr[date] * offset, true)) {
                // check if cross down sma recently
                for (let i = firstDayIndex; i < todayIndex; ++i) {
                    date = this.dates[i + 1];
                    yesterday = this.dates[i];
                    todayPrice = this.prices[date];
                    yesterdayPrice = this.prices[yesterday];
                    todaySMA = this.graph[date];
                    yesterdaySMA = this.graph[yesterday];
                    // price cross a little above sma
                    if (isCrossed(yesterdayPrice, todayPrice, yesterdaySMA + this.atr[yesterday] * offset, todaySMA + this.atr[date] * offset, false)) {
                        let buy = true;
                        // if section before dip was not above SMA for long enough
                        for (let j = i - this.previousLength; j < i; ++j) {
                            let d = this.dates[j];
                            if (this.prices[d] < this.graph[d]) { // - this.atr[date] * .5
                                buy = false;
                                break;
                            }
                        }
                        // if section within dip went too far
                        // for (let j = i; j < todayIndex; ++j) {
                        //     let d = this.dates[j];
                        //     if (this.prices[d] < this.graph[d] - this.atr[date]) {
                        //         buy = false;
                        //         break;
                        //     }
                        // }

                        if (buy) {
                            this.conditions = true;
                            this.freshness = this.expiration;

                            let buyDate = new Date(this.dates[dateIndex]);
                            if (this.lastBuy && daysBetween(this.lastBuy, buyDate) < 31) {
                                ++this.buyChain;
                            }
                            else {
                                this.buyChain = 0;
                            }
                            this.lastBuy = buyDate;;

                            // if portion before pullback was shared by 3 buy signals,
                            // probably consolidating, no breakout here
                            if (this.buyChain >= 2 && false) {
                                return Indicator.SELL;
                            }
                            else {
                                // check if price is already too high
                                let d = this.dates[dateIndex];
                                if (this.prices[d] >= this.graph[d] + 2 * this.atr[d]) {
                                    return Indicator.NOACTION;
                                }
                                else {
                                    return Indicator.BUY;
                                }
                            }
                        }
                    }
                }
            }
        }

        // look for entry candle (close above high)
        // if(this.conditions) {
        //     if (this.entryMet(dateIndex)) {
        //         this.conditions = false;
        //         return Indicator.BUY;
        //     }
        //     // entry must be met within expiration days of satisfing conditions 
        //     else {
        //         this.freshness -= 1;
        //         if (this.freshness == 0) {
        //             this.conditions = false;
        //         }
        //     }
        // }
        return Indicator.NOACTION;
    }
}

module.exports = Pullback;