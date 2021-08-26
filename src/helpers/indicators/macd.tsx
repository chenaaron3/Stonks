import { getMACD, getExponentialMovingAverage, isCrossed, normalizeRange } from '../utils';
import Indicator from './indicator';

import { MACDParams } from '@shared/indicator';
import { StockData } from '@shared/common';

class MACD extends Indicator {
	name = 'MACD';
	ema1 = 0;
	ema2 = 0;
	signalPeriod = 0;
	graph: StockData = {};
	signalLine: StockData = {};
	histogram: StockData = {};

	initialize(options: MACDParams) {
		this.ema1 = options.ema1;
		this.ema2 = options.ema2;
		this.signalPeriod = options.signalPeriod;
		this.graph = this.calculate();
		this.signalLine = this.signal();
		this.histogram = this.getHistogram();
	}

	calculate() {
		return getMACD(this.dates, this.prices, this.ema1, this.ema2);
	}

	signal() {
		let dates = Object.keys(this.graph).sort(function (a, b) {
			return new Date(a).valueOf() - new Date(b).valueOf();
		});
		return getExponentialMovingAverage(dates, this.graph, this.signalPeriod)["data"];
	}

	getHistogram() {
		let dates = Object.keys(this.graph).sort(function (a, b) {
			return new Date(a).valueOf() - new Date(b).valueOf();
		});
		let histogram: StockData = {};
		dates.forEach(date => {
			histogram[date] = this.graph[date] - this.signalLine[date];
		})
		return histogram;
	}

	getGraph() {
		return { MACD: this.graph, Signal: this.signalLine, Histogram: this.histogram };
	}

	getValue(date: string) {
		return { MACD_Histogram: this.histogram[date], MACD_Value: this.graph[date] };
	}

	normalize(data: number[]) {
		return data;
		// return normalizeRange(data);
	}

	getAction(date: string, dateIndex: number, isMain: boolean) {
		isMain = true; // force cross up entry

		let yesterday = this.dates[dateIndex - 1];

		let yesterdayMACD = this.graph[yesterday];
		let todayMACD = this.graph[date];
		let yesterdaySignal = this.signalLine[yesterday];
		let todaySignal = this.signalLine[date];

		let isCrossedUp = isCrossed(yesterdayMACD, todayMACD, yesterdaySignal, todaySignal, true); // green to red
		let isCrossedDown = isCrossed(yesterdayMACD, todayMACD, yesterdaySignal, todaySignal, false); // red to green
		if (isCrossedUp && todayMACD < 0) {
			return Indicator.BUY;
		}
		else if (isCrossedDown && todayMACD > 0) {
			return Indicator.SELL;
		}
		else {
			return Indicator.NOACTION;
		}
	}
}

export = MACD;