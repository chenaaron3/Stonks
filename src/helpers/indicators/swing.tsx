import { getSwingPivots } from '../utils';
import Indicator from './indicator';

import IndicatorType from '@shared/indicator';
import { PivotsData } from '../../types/types';

class Swing extends Indicator {
    name = 'Swing';
    period = 0;
    graph: PivotsData = {};

    initialize(options: IndicatorType.SwingParams) {
        this.period = options.period;
        this.graph = this.calculate();
    }

    calculate() {
        let pivots = getSwingPivots(this.dates, this.prices, this.period);
        return pivots;
    }

    getGraph() {
        return { pivots: this.graph };
    }

    getValue(date: string) {
        return this.graph[date];
    }

    normalize(data: number[]) {
        return data;
    }

    getAction(date: string, dateIndex: number, isMain: boolean) {
        return Indicator.NOACTION;
    }
}

export = Swing;