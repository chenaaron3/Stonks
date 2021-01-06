let { getTrueRange, getSimpleMovingAverage } = require('../utils');
let Indicator = require('./indicator');

class ATR extends Indicator {
    initialize(options) {
        this.period = options["period"];
        this.name = "ATR";
        this.graph = this.calculate();

    }

    calculate() {
        // true range
        let tr = getTrueRange(this.dates, this.highs, this.lows, this.closes);
        let newDates = [...this.dates];
        newDates.shift();
        let atr = getSimpleMovingAverage(newDates, tr["data"], this.period);

        // let sma = getSimpleMovingAverage(newDates, this.prices, 180);
        // this.offset1 = {};
        // this.offset2 = {};
        // this.offset3 = {};
        // Object.keys(atr).forEach(d => {
        //     this.offset1[d] = sma[d] + atr[d];
        //     // this.offset2[d] = sma[d] + 2 * atr[d];
        //     this.offset3[d] = sma[d] - atr[d];
        // })
        return atr;
    }

    getGraph() {
        return { ATR: this.graph }
    }

    getValue(date, dateIndex) {
        return this.graph[date];
    }
}

module.exports = ATR;