let {isCrossed, getSimpleMovingAverage} = require('./utils');
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

	getAction(date) {
		let yesterday = this.dates[this.dates.indexOf(date) - 1];

		let yesterdayMA1 = this.ma1[yesterday];
		let todayMA1 = this.ma1[date];
		let yesterdayMA2 = this.ma2[yesterday];
		let todayMA2 = this.ma2[date];

		let isCrossedUp = isCrossed(yesterdayMA1, todayMA1, yesterdayMA2, todayMA2, true);
		let isCrossedDown = isCrossed(yesterdayMA1, todayMA1, yesterdayMA2, todayMA2,  false);
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