let { getSimpleMovingAverage } = require('../utils');
let Indicator = require('./indicator');

class SMASupport extends Indicator {
    initialize(options) {
        this.period = options["period"];
        this.name = "SMASupport";
        this.graph = this.calculate();
    }

    calculate() {
        return getSimpleMovingAverage(this.dates, this.prices, this.period);
    }    

    getValue(date) {
		return this.graph[date];
	}

    getAction(date) {
        let todayPrice = this.prices[date];
        let todaySMA = this.graph[date];

        if (todayPrice >= todaySMA) {
            return Indicator.BUY;
        }
        else {
            return Indicator.SELL;
        }
    }
}

module.exports = SMASupport;