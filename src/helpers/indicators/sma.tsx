import { isCrossed, getSimpleMovingAverage, clampRange } from '../utils';
import Indicator from './indicator';

import IndicatorType from '@shared/indicator';
import { StockData } from '@shared/common';

class SMA extends Indicator {
    name = 'SMA';
    period = 0;
    minDuration = 0;
    strict = false;
    graph: StockData = {};

    initialize(options: IndicatorType.SMAParams) {
        this.period = options.period;
        this.minDuration = options.minDuration;
        this.strict = false;
        this.name = "SMA";
        this.graph = this.calculate();
    }

    calculate() {
        return getSimpleMovingAverage(this.dates, this.prices, this.period);
    }

    getGraph() {
        return { [`SMA(${this.period})`]: this.graph };
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
        let yesterdaySMA = this.graph[yesterday];
        let todaySMA = this.graph[date];

        // check consecutive days
        for (let i = firstDayIndex; i <= todayIndex; ++i) {
            yesterday = this.dates[i - 1];
            let today = this.dates[i];
            todayPrice = this.prices[today];
            yesterdaySMA = this.graph[yesterday];
            todaySMA = this.graph[today];

            // price < SMA, or SMA slope down violates
            if (todayPrice < todaySMA || (this.strict && todaySMA < yesterdaySMA)) {
                buy = false;
            }
        }

        let isCrossedDown = isCrossed(yesterdayPrice, todayPrice, yesterdaySMA, todaySMA, false);
        let isCrossedUp = isCrossed(yesterdayPrice, todayPrice, yesterdaySMA, todaySMA, true);

        if ((isMain && isCrossedUp) || (!isMain && buy)) {
            return Indicator.BUY;
        }
        else if (isCrossedDown) {
            return Indicator.SELL;
        }
        else {
            return Indicator.NOACTION;
        }
    }

    shouldStop(date: string) {
        let todayIndex = this.dates.indexOf(date);
        let firstDayIndex = Math.max(1, todayIndex - this.minDuration + 1);
        let stop = true;

        // check consecutive days
        for (let i = firstDayIndex; i <= todayIndex; ++i) {
            let yesterday = this.dates[i - 1];
            let today = this.dates[i];

            let yesterdayPrice = this.prices[yesterday];
            let todayPrice = this.prices[today];
            let todaySMA = this.graph[today];
            let todayHigh = this.highs[today];

            // 3 day in a row where high < SMA and price descending
            if (!(todaySMA > todayHigh && todayPrice < yesterdayPrice)) {
                stop = false;
            }
        }

        if (stop) {
            return Indicator.STOP;
        }
        else {
            return Indicator.NOACTION;
        }
    }
}

export = SMA;