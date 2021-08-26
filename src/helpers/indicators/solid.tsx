import { isCrossed, getSimpleMovingAverage, clampRange } from '../utils';
import Indicator from './indicator';

import { SolidParams } from '@shared/indicator';
import { StockData } from '@shared/common';

class Solid extends Indicator {
	name = 'Solid';
	minLength = 0;
	maxRatio = 0;

	initialize(options: SolidParams) {
		this.minLength = options.minLength;
		this.maxRatio = options.maxRatio;
	}

	calculate() {}

	getGraph() {
		return {};
	}

	getValue(date: string) {
		return 0;
	}

	normalize(data: number[]) {
		return clampRange(data);
	}

	getAction(date: string, dateIndex: number, isMain: boolean) {
		let todayIndex = dateIndex;
		let firstDayIndex = Math.max(0, todayIndex - this.minLength + 1);
		let buy = true;
		// candles with no tail
		for (let i = firstDayIndex; i <= todayIndex; ++i) {
			let day = this.dates[i];
			let candle = this.closes[day] - this.opens[day];
			let head = this.highs[day] - this.closes[day];
			if (candle < 0 || head / candle > this.maxRatio) {
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

export = Solid;