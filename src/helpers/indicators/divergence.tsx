import { getRealizedPivots, getSwingPivots, getRSI, getTrueRange, getSimpleMovingAverage, isHighLow } from '../utils';
import Indicator from './indicator';

import IndicatorType from '@shared/indicator';
import { StockData, PivotsData } from '@shared/common';

class Divergence extends Indicator {
    name = 'Divergence';
    period = 0;
    lookback = 0;
    maxRSI = 35;
    minATR = 0;
    signalOnRealize = false;
    graph: StockData = {};
    pivots: PivotsData = {};
    pivotDates: string[] = [];
    rsi: StockData = {};
    atr: StockData = {};

    initialize(options: IndicatorType.DivergenceParams) {
        this.period = options.period;
        this.lookback = options.lookback; // look back on up to x lows
        this.graph = this.calculate();
    }

    calculate() {
        let pivots = getSwingPivots(this.dates, this.prices, this.period);
        let pivotDates = Object.keys(pivots).sort();

        // maps daily dates to realized pivot points
        let realizedPivots: StockData = getRealizedPivots(pivots, pivotDates, this.dates);

        this.pivots = pivots;
        this.pivotDates = pivotDates;
        this.rsi = getRSI(this.dates, this.prices, 14);
        let tr = getTrueRange(this.dates, this.highs, this.lows, this.closes);
        this.atr = getSimpleMovingAverage(this.dates, tr["data"], this.period);

        return realizedPivots;
    }

    getGraph() {
        let debug: StockData = {};
        for (let i = 0; i < this.dates.length; ++i) {
            let date = this.dates[i];
            debug[date] = this.prices[this.pivotDates[this.graph[date]]];
        }
        return { Divergence: debug };
    }

    getValue(date: string) {
        return this.graph[date];
    }

    normalize(data: number[]) {
        return data;
    }

    getAction(date: string, dateIndex: number, isMain: boolean) {
        let price = this.prices[date];
        let rsi = this.rsi[date];
        let realizedIndex = this.graph[date];
        let lowCursor = realizedIndex;

        // fresh stock, have not realized any pivots
        if (realizedIndex < 0) {
            return Indicator.NOACTION;
        }
        // move cursor to most recent low
        else {
            // look for lows not highs
            if (this.pivots[this.pivotDates[realizedIndex]]["type"] == "high") {
                lowCursor -= 1;
            }
        }

        // decrement by 2 to skip high
        let lookbackCount = this.lookback;
        for (; lowCursor >= 2 && lookbackCount > 0; lowCursor -= 2) {
            let lowDate = this.pivotDates[lowCursor];

            // signal when realize a low (need low period)
            if (this.signalOnRealize) {
                let prevLowDate = this.pivotDates[lowCursor - 2];
                if (date == this.pivots[lowDate]["realized"] // when realized
                    && this.prices[prevLowDate] < this.prices[lowDate] // if higher low on price
                    && this.rsi[prevLowDate] > this.rsi[lowDate]) { // if lower low on rsi
                    return Indicator.BUY
                }
            }
            // signal on all lows
            else {
                if (price > this.prices[lowDate] + this.atr[lowDate] * this.minATR // if higher low on price
                    && rsi < this.rsi[lowDate] // if lower low on rsi
                    && rsi < this.maxRSI
                    && isHighLow(this.dates, this.prices, this.period, dateIndex)["low"]) { // if is a low
                    return Indicator.BUY;
                }
            }

            // reduce number of lookbacks
            --lookbackCount;
        }

        return Indicator.NOACTION;
    }
}

export = Divergence;