let { getRSI, isCrossed } = require('../utils');
let Indicator = require('./indicator');

class RSIDull extends Indicator {
    initialize(options) {
        this.period = options["period"];
        this.underbought = options["underbought"];
        this.overbought = options["overbought"];
        this.minDuration = 3;
        this.name = "RSI";
        this.graph = this.calculate();
    }

    calculate() {
        return getRSI(this.dates, this.prices, this.period);
    }

    getGraph() {
        return { RSI: this.graph };
    }

    getValue(date) {
        return this.graph[date];
    }

    normalize(data) {
        let res = [];
        data.forEach(d => {
            res.push(d / 100);
        })
        return res;
    }

    getAction(date, dateIndex, isMain) {
        let todayIndex = dateIndex;
        let firstDayIndex = Math.max(0, todayIndex - this.minDuration);
        let buy = true;
        // first day has to cross underbought
        for (let i = firstDayIndex; i <= todayIndex; ++i) {
            if (i == firstDayIndex) {
                if (!isCrossed(this.graph[this.dates[i]], this.graph[this.dates[i + 1]], this.underbought, this.underbought))
                {
                    buy = false;
                    break;
                }
            }
            if (this.graph[this.dates[i]] < this.underbought) {
                buy = false;
                break;
            }
        }

        let yesterday = this.dates[this.dates.indexOf(date) - 1];
        let yesterdayRSI = this.graph[yesterday];
        let todayRSI = this.graph[date];

        if (buy) {
            return Indicator.BUY;
        }
        else if (todayRSI < this.overbought && yesterdayRSI >= this.overbought) {
            return Indicator.SELL;
        }
        else {
            return Indicator.NOACTION;
        }
    }
}

module.exports = RSIDull;