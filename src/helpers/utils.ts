import { findOptimalRisk } from '../client/src/helpers/utils';
import { BarData, StockData, PivotsData } from '@shared/common';
import Backtest from '@shared/backtest';
import Indicator from '@shared/indicator';
import { GenericObject } from '../types/types';

// convert raw data from api to adjusted prices for backtest
function getAdjustedData(rawData: BarData[], lastUpdated: Date | undefined, strategyOptions: Backtest.StrategyOptions | undefined) {
    // maps date to closing price
    let prices: StockData = {};
    let volumes: StockData = {};
    let opens: StockData = {};
    let highs: StockData = {};
    let lows: StockData = {};
    let closes: StockData = {};

    // only get new data for update
    let cutoffIndex = 0;
    if (lastUpdated && strategyOptions) {
        // find first index where date is greater than last updated
        for (let i = rawData.length - 1; i >= 0; --i) {
            if (rawData[i]["date"] < lastUpdated) {
                cutoffIndex = i;
                break;
            }
        }
        let flattenedValues: number[] = [];
        // find maximum values used in strategy options
        let flatten = (indicator: Indicator.IndicatorParams) => {
            flattenedValues.push(Object.values<number>(indicator as unknown as { [s: string]: number; }).reduce((a, b) => a + b));
        };
        Object.values(strategyOptions.buyIndicators).forEach(flatten);
        Object.values(strategyOptions["sellIndicators"]).forEach(flatten);
        let margin = Math.max(...flattenedValues) + 100;
        // go back certain margin
        cutoffIndex = Math.max(0, cutoffIndex - margin);
    }

    // parse list into dictionaries
    for (; cutoffIndex < rawData.length; ++cutoffIndex) {
        let day = rawData[cutoffIndex];
        let date = new Date(day["date"]);

        let formattedDate = date.toISOString();
        prices[formattedDate] = day["close"];
        volumes[formattedDate] = day["volume"];
        opens[formattedDate] = day["open"];
        highs[formattedDate] = day["high"];
        lows[formattedDate] = day["low"];
        closes[formattedDate] = day["close"];
    };

    let dates = Object.keys(prices).sort(function (a, b) {
        return new Date(a).valueOf() - new Date(b).valueOf();
    });

    return { prices, volumes, opens, highs, lows, closes, dates };
}

// determine if line (x1, a1) => (x2, a2) crosses line (x1, b1) => (x2, b2)
function isCrossed(a1: number, a2: number, b1: number, b2: number, crossUp: boolean) {
    if (crossUp) {
        // smaller period has to start below or equal to greater period
        if (a1 <= b1) {
            // smaller period has to end above to greater period
            return a2 > b2;
        } else {
            return false;
        }
    }
    else {
        // smaller period has to start above or equal to greater period
        if (a1 >= b1) {
            // smaller period has to end below to greater period
            return a2 < b2;
        } else {
            return false;
        }
    }

}

// gets a list of points (date, price) for simple moving average
function getSimpleMovingAverage(dates: string[], prices: StockData, period: number) {
    let res: StockData = {};
    let sum = 0;
    // go through each date
    for (let i = 0; i < dates.length; ++i) {
        let day = dates[i];
        let originalSum = sum;
        // if not enough for moving sum, keep adding
        if (i < period) {
            sum += prices[day];
            if (i == period - 1) {
                res[day] = sum / period;
            }
        }
        // start saving moving sum
        else {
            sum += prices[day] - prices[dates[i - period]];
            res[day] = sum / period;
        }
        // rollback for errors
        if (Number.isNaN(sum)) {
            sum = originalSum;
            res[day] = sum / period;
        }
    }
    return res;
}

function getRSI(dates: string[], prices: StockData, period: number) {
    let res: StockData = {};
    let uts: StockData = {};
    let dts: StockData = {};
    for (let i = 1; i < dates.length; ++i) {
        let yesterday = dates[i - 1];
        let day = dates[i];
        let ut = prices[day] - prices[yesterday];
        let dt = prices[yesterday] - prices[day];
        ut = ut > 0 ? ut : 0;
        dt = dt > 0 ? dt : 0;
        uts[day] = ut;
        dts[day] = dt;
    }
    let newDates = [...dates];
    newDates.shift();

    // get wilder averages
    let avgU = getWilderSmoothing(newDates, uts, period);
    let avgD = getWilderSmoothing(newDates, dts, period);

    // if both valid
    if (avgU["valid"] && avgD["valid"]) {
        // start storing the RSI
        let startIndex = dates.indexOf(avgU["start"]!);
        for (let i = startIndex; i < dates.length; ++i) {
            let day = dates[i];
            let rs = avgU["data"][day] / avgD["data"][day];
            res[day] = 100 - (100 / (1 + rs));
        }
    }
    return res;
}

// gets a list of points (date, price) for Wilder's smoothing average
function getWilderSmoothing(dates: string[], prices: StockData, period: number) {
    let res: StockData = {};
    let sum = 0;
    let start = undefined;
    let avg = 0;
    // go through each date
    for (let i = 0; i < dates.length; ++i) {
        let day = dates[i];
        let price = prices[day];
        // if not enough for moving sum, keep adding
        if (i < period) {
            sum += price;
        }
        // start saving moving sum
        else {
            if (i == period) {
                start = day;
                avg = sum / period;
            }
            avg = avg * ((period - 1) / period) + price * (1 / period);
            res[day] = avg;
        }
    }
    return { valid: start != undefined, start: start, data: res };
}

function getMACD(dates: string[], prices: StockData, ema1period: number, ema2period: number) {
    let res: StockData = {};
    // get exponential averages
    let ema1 = getExponentialMovingAverage(dates, prices, ema1period);
    let ema2 = getExponentialMovingAverage(dates, prices, ema2period);

    // if both valid
    if (ema1["valid"] && ema2["valid"]) {
        // start storing the differences
        let startIndex = dates.indexOf(ema2["start"]!);
        for (let i = startIndex; i < dates.length; ++i) {
            let day = dates[i];
            res[day] = ema1["data"][day] - ema2["data"][day];
        }
    }
    return res;
}

// gets a list of points (date, price) for exponential moving average
function getExponentialMovingAverage(dates: string[], prices: StockData, period: number) {
    let res: StockData = {};
    let sum = 0;
    let start = undefined;
    let last = 0;
    let multiplier = 2.0 / (period + 1);
    // go through each date
    for (let i = 0; i < dates.length; ++i) {
        let day = dates[i];
        // if not enough for moving sum, keep adding
        if (i < period) {
            sum += prices[day];
        }
        // start saving moving sum
        else {
            if (i == period) {
                start = day;
                // last is the SMA
                last = sum / period;
            }
            res[day] = prices[day] * multiplier + last * (1 - multiplier);
            last = res[day];
        }
    }
    return { valid: start != undefined, start: start, data: res };
}

function getTrueRange(dates: string[], highs: StockData, lows: StockData, closes: StockData) {
    let res: StockData = {};
    let start = undefined;

    for (let i = 1; i < dates.length; ++i) {
        let day = dates[i];
        let yesterday = dates[i - 1];

        if (i == 1) {
            start = day;
        }
        res[day] = Math.max(highs[day] - lows[day], highs[day] - closes[yesterday], lows[day] - closes[yesterday]);
    }

    return { valid: start != undefined, start: start, data: res };
}

function getDirectionalMovement(dates: string[], highs: StockData, lows: StockData, positive: boolean) {
    let res: StockData = {};
    let start = undefined;

    for (let i = 1; i < dates.length; ++i) {
        let day = dates[i];
        let yesterday = dates[i - 1];
        let moveUp = highs[day] - highs[yesterday];
        let moveDown = lows[yesterday] - lows[day];

        if (i == 1) {
            start = day;
        }
        if (positive) {
            if (moveUp > moveDown && moveUp > 0) {
                res[day] = moveUp;
            }
            else {
                res[day] = 0;
            }
        }
        else {
            if (moveDown > moveUp && moveDown > 0) {
                res[day] = moveDown;
            }
            else {
                res[day] = 0;
            }
        }
    }

    return { valid: start != undefined, start: start, data: res };
}

function getSwingPivots(dates: string[], prices: StockData, period: number) {
    let pivots: PivotsData = {};
    let mode = "low";
    let swingDate = dates[0];

    for (let i = 0; i < dates.length; ++i) {
        let highLow = isHighLow(dates, prices, period, i);
        // if is a high
        if (highLow["high"]) {
            // mark previous low as official
            if (mode == "low") {
                // pivot is realized 1 day after
                pivots[swingDate] = { type: "low", date: swingDate, price: prices[swingDate], realized: dates[Math.min(i + 1, dates.length - 1)] };
                swingDate = dates[i];
                // switch mode
                mode = "high";
            }
            // continuation of a high
            else {
                // update swing
                swingDate = dates[i];
            }
        }
        // if is a low
        if (highLow["low"]) {
            // mark previous high as official
            if (mode == "high") {
                // pivot is realized 1 day after
                pivots[swingDate] = { type: "high", date: swingDate, price: prices[swingDate], realized: dates[Math.min(i + 1, dates.length - 1)] };
                swingDate = dates[i];
                // switch mode
                mode = "low";
            }
            // continuation of a low
            else {
                // update swing
                swingDate = dates[i];
            }
        }
    }

    return pivots;
}

function isHighLow(dates: string[], prices: StockData, period: number, dateIndex: number) {
    let currentPrice = prices[dates[dateIndex]];
    let res = { high: true, low: true };

    // check if any prices above current price
    let stopIndex = Math.max(0, dateIndex - period);
    for (let i = dateIndex - 1; i >= stopIndex; --i) {
        let price = prices[dates[i]]
        if (price > currentPrice) {
            res["high"] = false;
        }
        else if (price < currentPrice) {
            res["low"] = false;
        }
    }
    return res;
}

function howHighLow(dates: string[], prices: StockData, maxPeriod: number, dateIndex: number) {
    let currentPrice = prices[dates[dateIndex]];
    let reached = { high: false, low: false }
    let res = { high: 0, low: 0 };

    // check if any prices above current price
    let stopIndex = Math.max(0, dateIndex - maxPeriod);
    for (let i = dateIndex - 1; i >= stopIndex; --i) {
        let price = prices[dates[i]]
        if (price > currentPrice) {
            if (!reached["low"]) {
                res["low"] += 1;
            }
            reached["high"] = true;
        }
        else if (price < currentPrice) {
            if (!reached["high"]) {
                res["high"] += 1;
            }
            reached["low"] = true;
        }
        if (reached["high"] && reached["low"]) break;
    }
    return res;
}

function getStochasticOscillator(dates: string[], lows: StockData, prices: StockData, highs: StockData, period: number) {
    let res: StockData = {};

    for (let i = 0; i < dates.length; ++i) {
        let low = getLow(dates, lows, period, i);
        let high = getHigh(dates, highs, period, i);
        res[dates[i]] = ((prices[dates[i]] - low) / (high - low)) * 100;
    }

    return res;
}

function getHigh(dates: string[], prices: StockData, period: number, dateIndex: number) {
    let res = prices[dates[dateIndex]];

    // check if any prices above current price
    let stopIndex = Math.max(0, dateIndex - period + 1);
    for (let i = dateIndex - 1; i >= stopIndex; --i) {
        let price = prices[dates[i]]
        if (price > res) {
            res = price;
        }
    }

    return res;
}

function getLow(dates: string[], prices: StockData, period: number, dateIndex: number) {
    let res = prices[dates[dateIndex]];

    // check if any prices below current price
    let stopIndex = Math.max(0, dateIndex - period + 1);
    for (let i = dateIndex - 1; i >= stopIndex; --i) {
        let price = prices[dates[i]]
        if (price < res) {
            res = price;
        }
    }

    return res;
}

function getBacktestSummary(results: Backtest.ResultsData) {
    // find optimal settings
    let optimal = findOptimalRisk({
        range: 20, startSize: 1, maxPositions: 20, positionSize: 5,
        maxRisk: 15, scoreBy: 'Percent Profit', risk: 1, sizeOnRisk: false
    }, results);

    // return the metrics
    return optimal["metrics"];
}

// format date to api needs
function formatDate(date: string | Date) {
    var d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2)
        month = '0' + month;
    if (day.length < 2)
        day = '0' + day;

    return [year, month, day].join('-');
}

function hoursBetween(dt1: Date, dt2: Date) {
    var diff = (dt2.getTime() - dt1.getTime()) / 1000;
    diff /= (60 * 60);
    return Math.round(diff);
}

function daysBetween(date1: Date, date2: Date) {
    // The number of milliseconds in one day
    const ONE_DAY = 1000 * 60 * 60 * 24;
    // Calculate the difference in milliseconds
    const differenceMs = Math.abs(date1.valueOf() - date2.valueOf());
    // Convert back to days and return
    return Math.round(differenceMs / ONE_DAY);
}

function sameDay(d1: Date, d2: Date) {
    return d1.getFullYear() == d2.getFullYear() && d1.getMonth() == d2.getMonth() && d1.getDate() == d2.getDate();
}

function toPST(date: Date) {
    var utcDate = new Date(date.toUTCString());
    utcDate.setHours(utcDate.getHours() - 8);
    return new Date(utcDate);
}

function makeid(length: number) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

// used for 0-1
function clampRange(data: number[]) {
    if (data.length <= 1) {
        return data;
    }

    let min = Math.min(...data);
    let max = Math.max(...data);
    let res: number[] = [];
    data.forEach(d => {
        res.push((d - min) / (max - min));
    })
    return res;
}

// used for pos and neg
function normalizeRange(data: number[]) {
    let res: number[] = [];
    let sd = getStandardDeviation(data);
    let mean = getMean(data);
    data.forEach(d => {
        res.push((d - mean) / (sd));
    })
    return res;
}

function getStandardDeviation(array: number[]) {
    const n = array.length
    const mean = array.reduce((a, b) => a + b) / n
    return Math.sqrt(array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n)
}

function getMean(array: number[]) {
    const n = array.length;
    const mean = array.reduce((a, b) => a + b) / n;
    return mean;
}

function shallowEqual(object1: GenericObject, object2: GenericObject) {
    const keys1 = Object.keys(object1);
    const keys2 = Object.keys(object2);

    if (keys1.length !== keys2.length) {
        return false;
    }

    for (let key of keys1) {
        if (object1[key] !== object2[key]) {
            return false;
        }
    }

    return true;
}

// check if value is within reference +- range
function inRange(value: number, reference: number, range: number) {
    return value >= reference - range && value <= reference + range;
}

export {
    getAdjustedData, isCrossed, getSimpleMovingAverage, getRSI, getWilderSmoothing, getMACD, getExponentialMovingAverage, getTrueRange, getDirectionalMovement, getSwingPivots, isHighLow, howHighLow,
    getStochasticOscillator, formatDate, hoursBetween, daysBetween, sameDay, toPST, makeid, normalizeRange, clampRange, shallowEqual, getBacktestSummary, inRange
}