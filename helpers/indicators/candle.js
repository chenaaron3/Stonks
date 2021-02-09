let { isCrossed, getSimpleMovingAverage, clampRange } = require('../utils');
let Indicator = require('./indicator');

class Candle extends Indicator {
    initialize(options) {
        this.expiration = options["expiration"];
        this.name = "Candle";
        this.graph = this.calculate();
        this.freshness = 0;
        this.minLength = 1;
        this.hammer = {
            "headRatio": 1,
            "legRatio": 2
        };
        this.marubozu = {
            "headRatio": .1,
            "legRatio": .1
        };
    }

    calculate() {
        let graph = {};
        this.dates.forEach(date => {
            let isGreen = this.closes[date] > this.opens[date];
            let candle = Math.abs(this.closes[date] - this.opens[date]);
            let leg = isGreen ? this.opens[date] - this.lows[date] : this.closes[date] - this.lows[date];
            let head = isGreen ? this.highs[date] - this.closes[date] : this.highs[date] - this.opens[date];
            graph[date] = { isGreen, candle, leg, head, legRatio: leg / candle, headRatio: head / candle };
        })
        return graph;
    }

    getGraph() {
        return this.graph;
    }

    getValue(date) {
        let entry = this.graph[date];
        return { Leg_Ratio: entry["legRatio"], Head_Ratio: entry["headRatio"] };
    }

    normalize(data) {
        return clampRange(data);
    }

    getAction(date, dateIndex, isMain) {
        if (dateIndex == 0) return Indicator.NOACTION;

        let todayIndex = dateIndex;
        let firstDayIndex = Math.max(0, todayIndex - this.minLength + 1);
        let buy = false;
        // search for candlestick patterns
        for (let i = firstDayIndex; i <= todayIndex; ++i) {
            let day = this.dates[i];
            let yesterday = this.dates[i - 1]
            let candle = this.graph[day];
            let yesterdayCandle = this.graph[yesterday];
            // hammer
            if (candle["isGreen"] && candle["legRatio"] >= this.hammer["legRatio"] && candle["headRatio"] <= this.hammer["headRatio"]) {
                buy = true;
            }
            // marubozu
            if (candle["isGreen"] && candle["legRatio"] <= this.marubozu["legRatio"] && candle["headRatio"] <= this.marubozu["headRatio"]) {
                buy = true;
            }
            // engulfing
            if (candle["isGreen"] && !yesterdayCandle["isGreen"] && this.closes[yesterday] >= this.opens[day] && this.opens[yesterday] < this.closes[day]) {
                buy = true;
            }
            // close above high
            if (candle["isGreen"] && this.closes[day] > this.highs[yesterday]) {
                buy = true;
            }
        }

        this.freshness -= 1;
        if (buy || this.freshness > 0) {
            // reduce fresh
            if (buy) {
                this.freshness = this.expiration;
            }
            return Indicator.BUY;
        }
        else {
            return Indicator.NOACTION;
        }
    }
}

module.exports = Candle;