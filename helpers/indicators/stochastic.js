let { getStochasticOscillator } = require('../utils');
let Indicator = require('./indicator');

class Stochastic extends Indicator {
	initialize(options) {
		this.period = options["period"];
		this.underbought = options["underbought"];
		this.overbought = options["overbought"];
		this.name = "Stochastic";
		this.graph = this.calculate();
	}

	calculate() {
		return getStochasticOscillator(this.dates, this.lows, this.prices, this.highs, this.period);
	}

	getGraph() {
		return { Stochastic: this.graph };
	}

	getValue(date) {
		return this.graph[date] / 100;
	}

	normalize(data) {
        let res = [];
        data.forEach(d => {
            res.push(d / 100);
        })
        return res;
    }

	getAction(date, dateIndex, isMain) {
		let yesterday = this.dates[dateIndex - 1];

		let yesterdayStoch = this.graph[yesterday];
		let todayStoch = this.graph[date];

		if (todayStoch > this.underbought && yesterdayStoch <= this.underbought) {
			return Indicator.BUY;
		}
		else if (todayStoch < this.overbought && yesterdayStoch >= this.overbought) {
			return Indicator.SELL;
		}
		else {
			return Indicator.NOACTION;
		}
	}
}

module.exports = Stochastic;