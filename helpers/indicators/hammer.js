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
    }

    getGraph() {
        return {};
    }

    getValue(date) {
        return 0;
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