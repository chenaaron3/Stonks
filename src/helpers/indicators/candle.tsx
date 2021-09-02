import { isCrossed, getSimpleMovingAverage, clampRange } from '../utils';
import Indicator from './indicator';

import IndicatorType from '@shared/indicator';
import { StockData } from '@shared/common';

interface GraphData {
    [key: string]: {
        isGreen: boolean;
        candle: number;
        leg: number;
        head: number;
        legRatio: number;
        headRatio: number;
    }
}

class Candle extends Indicator {
    name = 'Candle';
    expiration = 0;
    graph: GraphData = {};
    freshness = 0;
    minLength = 1;
    hammer = {
        "headRatio": 1,
        "legRatio": 2
    }
    marubozu = {
        "headRatio": .1,
        "legRatio": .1
    }

    initialize(options: IndicatorType.CandleParams) {
        this.expiration = options.expiration;
        this.graph = this.calculate();
    }

    calculate() {
        let graph: GraphData = {};
        this.dates.forEach(date => {
            let isGreen = this.closes[date] > this.opens[date];
            let candle = Math.abs(this.closes[date] - this.opens[date]);
            let leg = isGreen ? this.opens[date] - this.lows[date] : this.closes[date] - this.lows[date];
            let head = isGreen ? this.highs[date] - this.closes[date] : this.highs[date] - this.opens[date];
            graph[date] = { isGreen, candle, leg, head, legRatio: leg / candle, headRatio: head / candle };
        })
        return graph;
    }

    getGraph() {
        let candles: StockData = {};
        let legs: StockData = {};
        let heads: StockData = {};
        let legRatios: StockData = {};
        let headRatios: StockData = {};
        this.dates.forEach(date => {
            candles[date] = this.graph[date].candle;
            legs[date] = this.graph[date].leg;
            heads[date] = this.graph[date].head;
            legRatios[date] = this.graph[date].legRatio;
            headRatios[date] = this.graph[date].headRatio;
        })
        return { candles, legs, heads, legRatios, headRatios }
    }

    getValue(date: string) {
        let entry = this.graph[date];
        return { Leg_Ratio: entry.legRatio, Head_Ratio: entry.headRatio };
    }

    normalize(data: number[]) {
        return clampRange(data);
    }

    getAction(date: string, dateIndex: number, isMain: boolean) {
        if (dateIndex == 0) return Indicator.NOACTION;

        let todayIndex = dateIndex;
        let firstDayIndex = Math.max(0, todayIndex - this.minLength + 1);
        let buy = false;
        // search for candlestick patterns
        for (let i = firstDayIndex; i <= todayIndex; ++i) {
            let day = this.dates[i];
            let yesterday = this.dates[i - 1]
            let candle = this.graph[day];
            let yesterdayCandle = this.graph[yesterday];
            // hammer
            if (candle["isGreen"] && candle["legRatio"] >= this.hammer["legRatio"] && candle["headRatio"] <= this.hammer["headRatio"]) {
                buy = true;
            }
            // marubozu
            if (candle["isGreen"] && candle["legRatio"] <= this.marubozu["legRatio"] && candle["headRatio"] <= this.marubozu["headRatio"]) {
                buy = true;
            }
            // engulfing
            if (candle["isGreen"] && !yesterdayCandle["isGreen"] && this.closes[yesterday] >= this.opens[day] && this.opens[yesterday] < this.closes[day]) {
                buy = true;
            }
            // close above high
            if (candle["isGreen"] && this.closes[day] > this.highs[yesterday]) {
                buy = true;
            }
        }

        this.freshness -= 1;
        if (buy || this.freshness > 0) {
            // reduce fresh
            if (buy) {
                this.freshness = this.expiration;
            }
            return Indicator.BUY;
        }
        else {
            return Indicator.NOACTION;
        }
    }
}

export =Candle;