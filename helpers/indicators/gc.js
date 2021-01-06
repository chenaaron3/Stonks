let { isCrossed, getSimpleMovingAverage, normalizeRange } = require('../utils');
let Indicator = require('./indicator');

class GC extends Indicator {
	initialize(options) {
		this.ma1Period = options["ma1Period"];
		this.ma2Period = options["ma2Period"];
		this.name = "GC";
		this.calculate();
	}

	calculate() {
		this.ma1 = getSimpleMovingAverage(this.dates, this.prices, this.ma1Period);
		this.ma2 = getSimpleMovingAverage(this.dates, this.prices, this.ma2Period);
	}

	getGraph() {
		return { [`GC_MA(${this.ma1Period})`]: this.ma1, [`GC_MA(${this.ma2Period})`]: this.ma2 };
	}

	getValue(date) {
		return this.ma1[date] - this.ma2[date];
	}

	normalize(data) {
		return normalizeRange(data);
	}

	getAction(date, dateIndex, isMain) {
		let yesterday = this.dates[dateIndex - 1];

		let yesterdayMA1 = this.ma1[yesterday];
		let todayMA1 = this.ma1[date];
		let yesterdayMA2 = this.ma2[yesterday];
		let todayMA2 = this.ma2[date];

		let isCrossedUp = isCrossed(yesterdayMA1, todayMA1, yesterdayMA2, todayMA2, true);
		let isCrossedDown = isCrossed(yesterdayMA1, todayMA1, yesterdayMA2, todayMA2, false);
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

module.exports = GC;