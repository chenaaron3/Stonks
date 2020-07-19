let {getRSI} = require('./utils');
let Indicator = require('./indicator');

class RSI extends Indicator {
	initialize(period, underbought, overbought) {
		this.period = period;
		this.underbought = underbought;
		this.overbought = overbought;
		this.name = "RSI";
		this.graph = this.calculate();
	}

	calculate() {
		return getRSI(this.dates, this.prices, this.period);
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