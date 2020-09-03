let { getMACD, getExponentialMovingAverage, isCrossed, clampRange } = require('../utils');
let Indicator = require('./indicator');

class MACDPos extends Indicator {
	initialize(options) {
		this.ema1 = options["ema1"];
		this.ema2 = options["ema2"];
		this.signalPeriod = options["signalPeriod"];
		this.name = "MACD";
		this.graph = this.calculate();
		this.signalLine = this.signal();
		this.histogram = this.histogram();
        this.buyThreshold = -0.01;
        this.sellThreshold = 1;
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
		return clampRange(data);
	}

	getAction(date) {
		let yesterday = this.dates[this.dates.indexOf(date) - 1];

		let yesterdayMACD = this.graph[yesterday];
		let todayMACD = this.graph[date];
		let yesterdaySignal = this.signalLine[yesterday];
		let todaySignal = this.signalLine[date];

		let isCrossedUp = isCrossed(yesterdayMACD, todayMACD, yesterdaySignal, todaySignal, true); // green to red
        let isCrossedBuyThreshold = isCrossed(yesterdayMACD, todayMACD, this.buyThreshold, this.buyThreshold, true);
        let isCrossedSellThreshold = isCrossed(yesterdayMACD, todayMACD, this.sellThreshold, this.sellThreshold, true)
		let green = this.histogram[date] > 0;
		let red = this.histogram[date] < 0;

        if (isCrossedBuyThreshold) {
			return Indicator.BUY;
		}
		else if (red) {
			return Indicator.SELL;
		}
		else {
			return Indicator.NOACTION;
		}
	}
}

module.exports = MACDPos;