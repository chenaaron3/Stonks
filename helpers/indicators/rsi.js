let {getRSI} = require('../utils');
let Indicator = require('./indicator');

class RSI extends Indicator {
	initialize(options) {
		this.period = options["period"];
		this.underbought = options["underbought"];
		this.overbought = options["overbought"];
		this.name = "RSI";
		this.graph = this.calculate();
	}

	calculate() {
		return getRSI(this.dates, this.prices, this.period);
	}

	getValue(date) {
		return this.graph[date];
	}

	getAction(date) {
		let yesterday = this.dates[this.dates.indexOf(date) - 1];

		let yesterdayRSI = this.graph[yesterday];
		let todayRSI = this.graph[date];

		if (todayRSI > this.underbought && yesterdayRSI <= this.underbought) {
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

module.exports = RSI;