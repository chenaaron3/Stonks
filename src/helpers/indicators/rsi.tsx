import { getRSI } from '../utils';
import Indicator from './indicator';

import IndicatorType from '@shared/indicator';
import { StockData } from '@shared/common';

class RSI extends Indicator {
	name = 'RSI';
	period = 0;
	underbought = 0;
	overbought = 0;
	graph: StockData = {};

	initialize(options: IndicatorType.RSIParams) {
		this.period = options.period;
		this.underbought = options.underbought;
		this.overbought = options.overbought;
		this.graph = this.calculate();
	}

	calculate() {
		return getRSI(this.dates, this.prices, this.period);
	}

	getGraph() {
		return { RSI: this.graph };
	}

	getValue(date: string) {
		return this.graph[date] / 100;
	}

	normalize(data: number[]) {
        let res: number[] = [];
        data.forEach(d => {
            res.push(d / 100);
        })
        return res;
    }

	getAction(date: string, dateIndex: number, isMain: boolean) {
		let yesterday = this.dates[dateIndex - 1];

		let yesterdayRSI = this.graph[yesterday];
		let todayRSI = this.graph[date];

		if (todayRSI > this.underbought && yesterdayRSI <= this.underbought) {
			return Indicator.BUY;
		}
		else if (todayRSI < this.overbought && yesterdayRSI >= this.overbought) {
			return Indicator.SELL;
		}
		else {
			return Indicator.NOACTION;
		}
	}
}

export = RSI;