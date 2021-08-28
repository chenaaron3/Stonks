import { getMACD, getExponentialMovingAverage, isCrossed, clampRange } from '../utils';
import Indicator from './indicator';

import IndicatorType from '@shared/indicator';
import { StockData } from '@shared/common';

class MACD2 extends Indicator {
	name = 'MACD2';
	ema1 = 0;
	ema2 = 0;
	signalPeriod = 0;
	buyThreshold = 0;
	graph: StockData = {};
	signalLine: StockData = {};
	histogram: StockData = {};

	initialize(options: IndicatorType.MACD2Params) {
		this.ema1 = options.ema1;
		this.ema2 = options.ema2;
		this.signalPeriod = options.signalPeriod;
		this.buyThreshold = options.buyThreshold;
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
		return this.graph[date];
	}

	normalize(data: number[]) {
		return clampRange(data);
	}

	getAction(date: string, dateIndex: number, isMain: boolean) {
		let yesterday = this.dates[dateIndex - 1];

		let yesterdayMACD = this.graph[yesterday];
		let todayMACD = this.graph[date];

        let isCrossedBuyThreshold = isCrossed(yesterdayMACD, todayMACD, this.buyThreshold, this.buyThreshold, true);
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

export = MACD2;