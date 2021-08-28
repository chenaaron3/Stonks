import { getStochasticOscillator } from '../utils';
import Indicator from './indicator';

import IndicatorType from '@shared/indicator';
import { StockData } from '@shared/common';

class Stochastic extends Indicator {
	name = 'Stochastic';
	period = 0;
	underbought = 0;
	overbought = 0;
	graph: StockData = {};

	initialize(options: IndicatorType.StochasticParams) {
		this.period = options.period;
		this.underbought = options.underbought;
		this.overbought = options.overbought;
		this.graph = this.calculate();
	}

	calculate() {
		return getStochasticOscillator(this.dates, this.lows, this.prices, this.highs, this.period);
	}

	getGraph() {
		return { Stochastic: this.graph };
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

		let yesterdayStoch = this.graph[yesterday];
		let todayStoch = this.graph[date];

		if (todayStoch > this.underbought && yesterdayStoch <= this.underbought) {
			return Indicator.BUY;
		}
		else if (todayStoch < this.overbought && yesterdayStoch >= this.overbought) {
			return Indicator.SELL;
		}
		else {
			return Indicator.NOACTION;
		}
	}
}

export = Stochastic;