import { isCrossed, getSimpleMovingAverage, getTrueRange } from '../utils';
import Indicator from './indicator';

import IndicatorType from '@shared/indicator';
import { StockData } from '@shared/common';

class Breakout extends Indicator {
    name = 'Breakout';
    period = 0;
    tests = 0;
    margin = 12;
    sma: StockData = {};
    atr: StockData = {};
    testCount = 0;
    lastTest = 0;

    initialize(options: IndicatorType.BreakoutParams) {
        this.period = options.period; // period of sma to check breakout
        this.tests = options.tests; // min number of test on sma
        this.margin = 12; // min days between each test
        this.name = "Breakout";
        this.calculate();
    }

    calculate() {
        this.sma = this.calculateSMA();
        this.atr = this.calculateATR();
    }

    calculateSMA() {
        return getSimpleMovingAverage(this.dates, this.prices, this.period);
    }

    calculateATR() {
        // true range
        let tr = getTrueRange(this.dates, this.highs, this.lows, this.closes);
        let newDates = [...this.dates];
        newDates.shift();
        let atr = getSimpleMovingAverage(newDates, tr["data"], this.period);
        return atr;
    }

    getGraph() {
        return { sma: this.sma, atr: this.atr };
    }

    getValue(date: string) {
        return this.sma[date];
    }

    normalize(data: number[]) {
        return data;
    }

    getAction(date: string, dateIndex: number, isMain: boolean) {
        let todayIndex = dateIndex;
        let yesterday = this.dates[todayIndex - 1];

        let todayPrice = this.prices[date];
        let yesterdayPrice = this.prices[yesterday];
        let todaySMA = this.sma[date];
        let yesterdaySMA = this.sma[yesterday];
        let offset = 0;

        this.lastTest -= 1;
        if (this.lastTest < 0) {
            // if cross down sma
            if (isCrossed(yesterdayPrice, todayPrice, yesterdaySMA + this.atr[yesterday] * offset, todaySMA + this.atr[date] * offset, false)) {
                let firstDayIndex = Math.max(0, todayIndex - 12); // 12 days for test
                // check if cross up sma recently
                for (let i = firstDayIndex; i < todayIndex; ++i) {
                    date = this.dates[i + 1];
                    yesterday = this.dates[i];
                    todayPrice = this.prices[date];
                    yesterdayPrice = this.prices[yesterday];
                    todaySMA = this.sma[date];
                    yesterdaySMA = this.sma[yesterday];

                    // cross up
                    if (isCrossed(yesterdayPrice, todayPrice, yesterdaySMA + this.atr[yesterday] * offset, todaySMA + this.atr[date] * offset, true)) {
                        this.testCount += 1;
                        this.lastTest = this.margin;
                    }
                }
            }
        }

        offset = 1;
        // cross ATR
        if (isCrossed(yesterdayPrice, todayPrice, yesterdaySMA + this.atr[yesterday] * offset, todaySMA + this.atr[date] * offset, true)) {
            // have enough tests to check breakout
            if (this.testCount >= this.tests) {
                return Indicator.BUY;
            }
            this.testCount = 0;
        }

        // above atr, reset tests
        if (todayPrice > todaySMA + this.atr[date] * offset) {
            this.testCount = 0;
        }

        return Indicator.NOACTION;
    }
}

export = Breakout;