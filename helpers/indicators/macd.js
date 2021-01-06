let { getMACD, getExponentialMovingAverage, isCrossed, normalizeRange } = require('../utils');
let Indicator = require('./indicator');

class MACD extends Indicator {
	initialize(options) {
		this.ema1 = options["ema1"];
		this.ema2 = options["ema2"];
		this.signalPeriod = options["signalPeriod"];
		this.name = "MACD";
		this.graph = this.calculate();
		this.signalLine = this.signal();
		this.histogram = this.histogram();
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

	histogram() {
		let dates = Object.keys(this.graph).sort(function (a, b) {
			return new Date(a) - new Date(b);
		});
		let histogram = {};
		dates.forEach(date => {
			histogram[date] = this.graph[date] - this.signalLine[date];
		})
		return histogram;
	}

	getGraph() {
		return { MACD: this.graph, Signal: this.signalLine, Histogram: this.histogram };
	}

	getValue(date) {
		return this.graph[date];
	}

	normalize(data) {
		return data;
		// return normalizeRange(data);
	}

	getAction(date, dateIndex, isMain) {
		let yesterday = this.dates[dateIndex - 1];

		let yesterdayMACD = this.graph[yesterday];
		let todayMACD = this.graph[date];
		let yesterdaySignal = this.signalLine[yesterday];
		let todaySignal = this.signalLine[date];

		let isCrossedUp = isCrossed(yesterdayMACD, todayMACD, yesterdaySignal, todaySignal, true); // green to red
		let isCrossedDown = isCrossed(yesterdayMACD, todayMACD, yesterdaySignal, todaySignal, false); // red to green
		if (isCrossedUp || (!isMain && this.histogram[date] > 0)) {
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