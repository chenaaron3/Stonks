let {isCrossed, getSimpleMovingAverage} = require('./utils');
let Indicator = require('./indicator');

class SMA extends Indicator {
	initialize(period) {
		this.period = period;
		this.name = "SMA";
		this.graph = this.calculate();
	}

	calculate() {
		return getSimpleMovingAverage(this.dates, this.prices, this.period);
	}

	getAction(date) {
		let yesterday = this.dates[this.dates.indexOf(date) - 1];

		let yesterdayPrice = this.prices[yesterday];
		let todayPrice = this.prices[date];
		let yesterdaySMA = this.graph[yesterday];
		let todaySMA = this.graph[date];

		let isCrossedUp = isCrossed(yesterdayPrice, todayPrice, yesterdaySMA, todaySMA, true);
		let isCrossedDown = isCrossed(yesterdayPrice, todayPrice, yesterdaySMA, todaySMA, false);
		if (isCrossedUp) {
			return Indicator.BUY;
		}
		else if (isCrossedDown) {
			return Indicator.SELL;
		}
		else {
			return Indicator.NOACTION;
		}
	}
}

module.exports = SMA;