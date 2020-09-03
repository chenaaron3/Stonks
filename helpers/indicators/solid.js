let { isCrossed, getSimpleMovingAverage, clampRange } = require('../utils');
let Indicator = require('./indicator');

class Solid extends Indicator {
	initialize(options) {
		this.minLength = options["minLength"];
		this.maxRatio = options["maxRatio"];
		this.name = "Solid";
	}

	getGraph() {
		return {};
	}

	getValue(date) {
		return 0;
	}

	normalize(data) {
        return clampRange(data);
    }

	getAction(date) {
		let todayIndex = this.dates.indexOf(date);
		let firstDayIndex = Math.max(0, todayIndex - this.minLength + 1);
		let buy = true;
		// candles with no tail
		for (let i = firstDayIndex; i <= todayIndex; ++i) {
			let day = this.dates[i];
			let candle = this.closes[day] - this.opens[day];
			if ( candle > 0 && candle * (1 + this.maxRatio) >= this.highs[day]) {
				buy = false;
				break;
			}
		}

		if (buy) {
			return Indicator.BUY;
		}
		else {
			return Indicator.NOACTION;
		}
	}
}

module.exports = Solid;