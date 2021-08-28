import { isCrossed, getExponentialMovingAverage, daysBetween, getSwingPivots, howHighLow } from '../utils';
import Indicator from './indicator';

import IndicatorType from '@shared/indicator';
import { StockData } from '@shared/common';
import { PivotsData, PivotData } from '../../types/types';

interface GraphData {
    [key: string]: {
        support: number;
        resistance: number;
    }
}

class Structure extends Indicator {
    name = 'Structure';
    period = 0;
    volatility = 0;
    minCount = 0;
    graph: GraphData = {};
    pivots: PivotsData = {};
    freshness = 720;
    limitLevel: number = null!;

    initialize(options: IndicatorType.StructureParams) {
        this.period = options.period;
        this.volatility = options.volatility;
        this.minCount = options.minCount;
        this.pivots = {};
        this.graph = this.calculate();
    }

    calculate() {
        let graph: GraphData = {};
        let pivots = getSwingPivots(this.dates, this.prices, this.period);
        this.pivots = pivots;
        let realizedPivots: { [key: string]: PivotData } = {}
        let keys = Object.keys(pivots);

        // maps realized date to its pivot
        for (let i = 0; i < keys.length; ++i) {
            let pivotDate = keys[i];
            let pivot = pivots[pivotDate];
            pivot.date = pivotDate;
            realizedPivots[pivot.realized] = pivot;
        }

        interface MergedData {
            [key: number]: {
                start: string; // start of line
                end: string; // end of line
                count: number; // number of pivots that hit this line
                score: number; // more number of days on structure, higher the score
                support: boolean; // used as support
                resistance: boolean; // used as resistance
                freshness: number; // how recent this structure was tested
            }
        }
        let merged: MergedData = {};
        for (let i = 0; i < this.dates.length; ++i) {
            let date = this.dates[i];
            let price = this.prices[date];

            // is a pivot, update merged dict
            if (realizedPivots.hasOwnProperty(date)) {
                let pivot = realizedPivots[date];
                let groupMatch = undefined;
                let groupAverages = Object.keys(merged).map(Number);

                // look for a group that is close to this pivot
                for (let i = 0; i < groupAverages.length; ++i) {
                    let groupAverage = groupAverages[i];
                    if (groupAverage * (1 + this.volatility) > pivot.price && groupAverage * (1 - this.volatility) < pivot.price) {
                        groupMatch = groupAverage;
                        break;
                    }
                }

                let score = howHighLow(this.dates, this.prices, 200, this.dates.indexOf(pivot.date))[pivot.type];

                // if found a group, add to group
                if (groupMatch) {
                    let oldStart = merged[groupMatch].start;
                    let oldCount = merged[groupMatch].count;
                    let oldScore = merged[groupMatch].score;
                    let newCount = oldCount + 1;
                    let newAverage = (groupMatch * oldCount + pivot.price) / newCount;
                    let newSupport = merged[groupMatch].support || pivot.type == "low";
                    let newResistance = merged[groupMatch].resistance || pivot.type == "high";
                    // remove old group
                    delete merged[groupMatch];
                    // relocate group
                    merged[newAverage] = {
                        count: newCount, score: oldScore + score, end: pivot.date, start: oldStart,
                        support: newSupport, resistance: newResistance,
                        freshness: this.freshness
                    };
                }
                // if not found, create a group
                else {
                    merged[pivot.price] = {
                        count: 1, score: score, end: pivot.date, start: pivot.date,
                        support: pivot.type == "low", resistance: pivot.type == "high",
                        freshness: this.freshness
                    };
                }
            }

            // trim merge dict of irrelevant levels
            keys = Object.keys(merged);
            for (let i = 0; i < keys.length; ++i) {
                let key = Number(keys[i]);
                merged[key].freshness -= 1;
                if (merged[key].freshness <= 0) {
                    delete merged[key];
                }
            }

            let levels = Object.keys(merged).map(Number);
            // find areas of value with both support and resistance tested
            let potentialSupports = levels.filter(level => level < price && merged[level].support && merged[level].resistance && merged[level].count > this.minCount);
            let potentialResistances = levels.filter(level => level > price && merged[level].support && merged[level].resistance && merged[level].count > this.minCount);
            let support: number = null!;
            let resistance: number = null!;
            potentialSupports.forEach(level => {
                // score by relevance and strength
                // if (support == undefined || merged[level]["score"] * merged[level]["freshness"] > merged[support]["score"] * merged[support]["freshness"]) {
                if (support == undefined || merged[level].count > merged[support].count) {
                    support = level;
                }
            });
            potentialResistances.forEach(level => {
                // score by relevance and strength
                // if (resistance == undefined || merged[level]["score"] * merged[level]["freshness"] > merged[resistance]["score"] * merged[resistance]["freshness"]) {
                if (resistance == undefined || merged[level].count > merged[resistance].count) {
                    resistance = level;
                }
            })


            let entry = {
                support: support,
                resistance: resistance
            }

            // use relaxed level (doesnt have to be both support and resistance) if area of value not found
            if (!entry.support) {
                entry.support = Math.min(...levels.filter(level => level < price));
            }
            if (!entry.resistance) {
                entry.resistance = Math.max(...levels.filter(level => level > price));
            }

            graph[date] = entry;
        }
        return graph;
    }

    getGraph() {
        // greatest level below price
        let support: StockData = {};
        // smallest level above price 
        let resistance: StockData = {};

        // transform data
        Object.keys(this.graph).forEach(date => {
            support[date] = this.graph[date].support;
            resistance[date] = this.graph[date].resistance;
        })

        return { support, resistance, pivots: this.pivots };
    }

    getValue(date: string) {
        return this.graph[date];
    }

    normalize(data: number[]) {
        return data;
    }

    getAction(date: string, dateIndex: number, isMain: boolean) {
        let todayIndex = dateIndex;
        let yesterday = this.dates[todayIndex - 1];
        let beforeYesterday = this.dates[todayIndex - 2];

        // Buy if candle crossed any major structure yesterday and close above today
        if (!this.graph.hasOwnProperty(date)) {
            return Indicator.NOACTION
        }

        let { support, resistance } = this.graph[date];
        let levels: number[] = [];
        if (support) levels.push(support);
        if (resistance) levels.push(resistance);

        // price crosses
        let yesterdayBodyCrossUp = levels.find(level => isCrossed(this.prices[beforeYesterday], this.prices[yesterday], level, level, true));
        let yesterdayBodyCrossDown = levels.find(level => isCrossed(this.prices[beforeYesterday], this.prices[yesterday], level, level, false));
        let todayBodyCrossUp = levels.find(level => isCrossed(this.prices[yesterday], this.prices[date], level, level, true));
        let todayBodyCrossDown = levels.find(level => isCrossed(this.prices[yesterday], this.prices[date], level, level, false));

        // find an upper level in case there is no upper limit
        let limitReached = false;
        if (!resistance && this.limitLevel) {
            limitReached = isCrossed(this.prices[yesterday], this.prices[date], this.limitLevel, this.limitLevel, true)
        }

        // if today cross new level, sell
        if (todayBodyCrossUp) {
            return Indicator.SELL;
        }

        // if yesterday cross and today still above level
        if (yesterdayBodyCrossUp && this.prices[date] > yesterdayBodyCrossUp) {
            // make sure not already too high
            if (resistance && this.prices[date] > (resistance + support) / 2) {
                return Indicator.NOACTION;
            }
            // track limit
            if (support) {
                this.limitLevel = this.prices[date] + (this.prices[date] - support);
            }
            return Indicator.BUY;
        }
        else if ((yesterdayBodyCrossDown && this.prices[yesterday] > this.prices[date]) || limitReached) {
            return Indicator.SELL;
        }
        else {
            return Indicator.NOACTION;
        }
    }
}

export = Structure;