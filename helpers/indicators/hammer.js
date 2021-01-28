let { isCrossed, getSimpleMovingAverage, clampRange } = require('../utils');
let Indicator = require('./indicator');

class Hammer extends Indicator {
    initialize(options) {
        this.minLength = 1;
        this.headRatio = options["headRatio"];
        this.legRatio = options["legRatio"];
        this.expiration = options["expiration"];
        this.name = "Hammer";
        this.freshness = 0;
        this.graph = this.calculate();
    }

    calculate() {
        let graph = {};
        this.dates.forEach(date => {
            let isGreen = this.closes[date] > this.opens[date];
            let candle = Math.abs(this.closes[date] - this.opens[date]);
            let leg = isGreen ? this.opens[date] - this.lows[date] : this.closes[date] - this.lows[date];
            let head = isGreen ? this.highs[date] - this.closes[date] : this.highs[date] - this.opens[date];
            graph[date] = { legRatio: leg / candle, headRatio: head / candle };
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
        let todayIndex = dateIndex;
        let firstDayIndex = Math.max(0, todayIndex - this.minLength + 1);
        let buy = true;
        // candles with legs longer than body
        for (let i = firstDayIndex; i <= todayIndex; ++i) {
            let day = this.dates[i];
            let candle = this.closes[day] - this.opens[day];
            let leg = this.opens[day] - this.lows[day];
            let head = this.highs[day] - this.closes[day];
            if (candle < 0 || leg / candle < this.legRatio || head / candle > this.headRatio) {
                buy = false;
                break;
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

module.exports = Hammer;