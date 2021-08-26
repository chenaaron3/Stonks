import { getTrueRange, getSimpleMovingAverage } from '../utils';
import Indicator from './indicator';

import { ATRParams } from '@shared/indicator';
import { StockData } from '@shared/common';

class ATR extends Indicator {
    name = 'ATR';
    period = 0;
    graph: StockData = {};

    initialize(options: ATRParams) {
        this.period = options.period;
        this.graph = this.calculate();
    }

    calculate() {
        // true range
        let tr = getTrueRange(this.dates, this.highs, this.lows, this.closes);
        let newDates = [...this.dates];
        newDates.shift();
        let atr = getSimpleMovingAverage(newDates, tr["data"], this.period);

        // let sma = getSimpleMovingAverage(newDates, this.prices, 180);
        // this.offset1 = {};
        // this.offset2 = {};
        // this.offset3 = {};
        // Object.keys(atr).forEach(d => {
        //     this.offset1[d] = sma[d] + atr[d];
        //     // this.offset2[d] = sma[d] + 2 * atr[d];
        //     this.offset3[d] = sma[d] - atr[d];
        // })
        return atr;
    }

    getGraph() {
        return { ATR: this.graph }
    }

    getValue(date: string) {
        return this.graph[date];
    }

    normalize(data: number[]) { return data }

    getAction(date: string, dateIndex: number, isMain: boolean) { return Indicator.NOACTION }
}

export = ATR;