import { isCrossed, getExponentialMovingAverage, clampRange } from '../utils';
import Indicator from './indicator';

import IndicatorType from '@shared/indicator';
import { StockData } from '@shared/common';

class EMA extends Indicator {
    name = 'EMA';
    period = 0;
    minDuration = 0;
    graph: StockData = {};

    initialize(options: IndicatorType.EMAParams) {
        this.period = options["period"];
        this.minDuration = options["minDuration"];
        this.graph = this.calculate();
    }

    calculate() {
        return getExponentialMovingAverage(this.dates, this.prices, this.period)["data"];
    }

    getGraph() {
        return { [`EMA(${this.period})`]: this.graph };
    }

    getValue(date: string) {
        return this.graph[date];
    }

    normalize(data: number[]) {
        return clampRange(data);
    }

    getAction(date: string, dateIndex: number, isMain: boolean) {
        let todayIndex = dateIndex;
        let firstDayIndex = Math.max(1, todayIndex - this.minDuration + 1);
        let buy = true;

        let yesterday = this.dates[todayIndex - 1];
        let yesterdayPrice = this.prices[yesterday];
        let todayPrice = this.prices[date];
        let yesterdayEMA = this.graph[yesterday];
        let todayEMA = this.graph[date];

        // check consecutive days
        for (let i = firstDayIndex; i <= todayIndex; ++i) {
            yesterday = this.dates[i - 1];
            let today = this.dates[i];
            todayPrice = this.prices[today];
            yesterdayEMA = this.graph[yesterday];
            todayEMA = this.graph[today];

            // price < ema, or ema slope down violates
            if (todayPrice < todayEMA || todayEMA < yesterdayEMA) {
                buy = false;
            }
        }

        let isCrossedDown = isCrossed(yesterdayPrice, todayPrice, yesterdayEMA, todayEMA, false);
        if (buy) {
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


export = EMA;