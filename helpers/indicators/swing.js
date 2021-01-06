let { isCrossed } = require('../utils');
let Indicator = require('./indicator');

class Swing extends Indicator {
    initialize(options) {
        this.period = options["period"];
        this.name = "Swing";
        this.graph = this.calculate();
    }

    calculate() {
        let diff = [];
        let last = this.prices[this.dates[0]];
        // calc diff in prices
        for (let i = 0; i < this.dates.length; ++i) {
            let day = this.dates[i];
            let price = this.prices[day];
            diff.push(price - last);
            last = price;
        }

        let sign = [];
        // calc signs of diff
        for (let i = 0; i < diff.length; ++i) {
            if (diff[i] > 0) {
                sign.push(1);
            }
            else if (diff[i] < 0) {
                sign.push(-1);
            }
            else {
                sign.push(0);
            }
        }

        // calc diff of signs
        let signDiff = [];
        for (let i = 1; i < sign.length; ++i) {
            signDiff.push(sign[i] - sign[i - 1]);
        }

        let pivots = {};
        for (let i = 0; i < signDiff.length; ++i) {
            if (signDiff[i] < 0) {
                let z = Math.max(i - this.period + 1, 1);
                let w = Math.min(i + this.period + 1, signDiff.length);
                let isPivot = true;
                for (let j = z; j < i; ++j) {
                    if (this.prices[this.dates[j]] > this.prices[this.dates[i + 1]]) {
                        isPivot = false;
                    }
                }
                for (let j = i + 2; j < w; ++j) {
                    if (this.prices[this.dates[j]] > this.prices[this.dates[i + 1]]) {
                        isPivot = false;
                    }
                }

                let day = this.dates[i];
                let price = this.prices[day];
                if (isPivot) {
                    pivots[day] = price;
                }
            }
        }

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