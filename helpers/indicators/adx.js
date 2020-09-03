let { isCrossed, getTrueRange, getDirectionalMovement, getExponentialMovingAverage, getSimpleMovingAverage } = require('../utils');
let Indicator = require('./indicator');

class ADX extends Indicator {
    initialize(options) {
        this.period = options["period"];
        this.name = "ADX";
        this.graph = this.calculate();
    }

    calculate() {
        // true range
        let tr = getTrueRange(this.dates, this.highs, this.lows, this.closes);
        // positive directional movement
        let pdm = getDirectionalMovement(this.dates, this.highs, this.lows, true);
        // negative directional movement
        let ndm = getDirectionalMovement(this.dates, this.highs, this.lows, false);

        // smoothed versions
        let newDates = [...this.dates];
        newDates.shift();
        let atr = getSimpleMovingAverage(newDates, tr["data"], this.period);
        let apdm = getSimpleMovingAverage(newDates, pdm["data"], this.period);
        let andm = getSimpleMovingAverage(newDates, ndm["data"], this.period);

        // calculate +/-DI
        let pdi = {};
        let ndi = {};
        let dx = {};
        newDates = newDates.slice(this.period);
        newDates.forEach(d => {
            pdi[d] = apdm[d] / atr[d] * 100;
            ndi[d] = andm[d] / atr[d] * 100;
            dx[d] = Math.abs(pdi[d] - ndi[d]) / Math.abs(pdi[d] + ndi[d]) * 100;
        });

        // calculate adx
        let adx = {};
        let count = 0;
        let sum = 0;
        let prev = 0;
        newDates.forEach(d => {
            // First ADX = sum 14 periods of DX / period
            if (count < this.period) {
                sum += dx[d];
            }
            else if (count == this.period) {
                adx[d] = sum / count;
                prev = adx[d];
            }
            //  ADX = ((Prior ADX * (period - 1)) + Current DX) /period
            else {
                adx[d] = (prev * (this.period - 1) + dx[d]) / this.period;
                prev = adx[d];
            }
            count += 1;
        })
        this.pdi = pdi;
        this.ndi = ndi;

        return adx;
    }

    getGraph() {
        return { ADX: this.graph, PDI: this.pdi, NDI: this.ndi }
    }

    getValue(date) {
        return this.graph[date];
    }

    normalize(data) {
        let res = [];
        data.forEach(d => {
            res.push(d / 100);
        })
        return res;
    }

    getAction(date) {
        let yesterday = this.dates[this.dates.indexOf(date) - 1];

        let yesterdayPDI = this.pdi[yesterday];
        let todayPDI = this.pdi[date];
        let yesterdayNDI = this.ndi[yesterday];
        let todayNDI = this.ndi[date];

        let isCrossedUp = isCrossed(yesterdayPDI, todayPDI, yesterdayNDI, todayNDI, true);
        let isCrossedDown = isCrossed(yesterdayPDI, todayPDI, yesterdayNDI, todayNDI, false);
        if (todayPDI > todayNDI && this.graph[date] > 25) {
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

module.exports = ADX;