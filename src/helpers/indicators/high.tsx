import { isCrossed, getSimpleMovingAverage, clampRange } from '../utils';
import Indicator from './indicator';

import { HighParams } from '@shared/indicator';
import { StockData } from '@shared/common';

class High extends Indicator {
    name = 'High';
    period = 0;
    graph: StockData = {};

    initialize(options: HighParams) {
        this.period = options.period;
        this.graph = this.calculate();
    }

    calculate() {
        let graph: StockData = {}

        var maxSlidingWindow = function (nums: number[], k: number) {
            const q = [];  // stores *indices*
            const res = [];
            for (let i = 0; i < nums.length; i++) {
                while (q && nums[q[q.length - 1]] <= nums[i]) {
                    q.pop();
                }
                q.push(i);
                // remove first element if it's outside the window
                if (q[0] === i - k) {
                    q.shift();
                }
                res.push(nums[q[0]]);
            }
            return res;
        };

        let flatClose: number[] = [];
        this.dates.forEach((date) => {
            flatClose.push(this.closes[date]);
        });

        let maxes = maxSlidingWindow(flatClose, this.period);

        this.dates.forEach((date, i) => {
            graph[date] = maxes[i]
        });

        return graph;
    }

    getGraph() {
        return { "High": this.graph };
    }

    getValue(date: string) {
        return this.graph[date];
    }

    normalize(data: number[]) {
        return clampRange(data);
    }

    getAction(date: string, dateIndex: number, isMain: boolean) {
        return Indicator.NOACTION;
    }
}

export = High;