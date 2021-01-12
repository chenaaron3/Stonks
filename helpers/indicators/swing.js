let { isCrossed, getSwingPivots } = require('../utils');
let Indicator = require('./indicator');

class Swing extends Indicator {
    initialize(options) {
        this.period = options["period"];
        this.name = "Swing";
        this.graph = this.calculate();
    }

    calculate() {
        let pivots = getSwingPivots(this.dates, this.prices, this.period);
        return pivots;
    }

    getGraph() {
        return { pivots: this.graph };
    }

    getValue(date) {
        return this.graph[date];
    }

    normalize(data) {
        return data;
    }

    getAction(date, dateIndex, isMain) {

    }
}

module.exports = Swing;