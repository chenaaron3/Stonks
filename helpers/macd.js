let {getMACD, getExponentialMovingAverage, isCrossed} = require('./utils');
let Indicator = require('./indicator');

class MACD extends Indicator {
	initialize(ema1, ema2, signalPeriod) {
		this.ema1 = ema1;
		this.ema2 = ema2;
		this.signalPeriod = signalPeriod;
		this.name = "MACD";
		this.graph = this.calculate();
		this.signalLine = this.signal();
	}

	calculate() {
		return getMACD(this.dates, this.prices, this.ema1, this.ema2);
	}

	signal() {
		let dates = Object.keys(this.graph).sort(function (a, b) {
	        return new Date(a) - new Date(b);
	    });
		return getExponentialMovingAverage(dates, this.graph, this.signalPeriod)["data"];
	}

	getAction(date) {
		let yesterday = this.dates[this.dates.indexOf(date) - 1];

		let yesterdayMACD = this.graph[yesterday];
		let todayMACD = this.graph[date];
		let yesterdaySignal = this.signalLine[yesterday];
		let todaySignal = this.signalLine[date];

		let isCrossedUp = isCrossed(yesterdayMACD, todayMACD, yesterdaySignal, todaySignal, true);
		let isCrossedDown = isCrossed(yesterdayMACD, todayMACD, yesterdaySignal, todaySignal, false);
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

module.exports = MACD;