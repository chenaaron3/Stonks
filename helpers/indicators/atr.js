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