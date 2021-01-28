let { isCrossed, getTrueRange, getDirectionalMovement, getWilderSmoothing } = require('../utils');
let Indicator = require('./indicator');

class ADX extends Indicator {
    initialize(options) {
        this.period = options["period"];
        this.threshold = options["threshold"];
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
        let atr = getWilderSmoothing(newDates, tr["data"], this.period)["data"];
        let apdm = getWilderSmoothing(newDates, pdm["data"], this.period)["data"];
        let andm = getWilderSmoothing(newDates, ndm["data"], this.period)["data"];

        // calculate +/-DI
        let pdi = {};
        let ndi = {};
        let dx = {};
        let histogram = {};
        newDates = newDates.slice(this.period);
        newDates.forEach(d => {
            pdi[d] = apdm[d] / atr[d] * 100;
            ndi[d] = andm[d] / atr[d] * 100;
            dx[d] = Math.abs(pdi[d] - ndi[d]) / Math.abs(pdi[d] + ndi[d]) * 100;
            histogram[d] = pdi[d] - ndi[d];
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
        this.histogram = histogram;

        return adx;
    }

    getGraph() {
        return { ADX: this.graph, PDI: this.pdi, NDI: this.ndi }
    }

    getValue(date) {
        return {ADX_Value: this.graph[date] / 100, ADX_Histogram: this.histogram[date] / 100};
    }

    normalize(data) {
        let res = [];
        data.forEach(d => {
            res.push(d / 100);
        })
        return res;
    }

    getAction(date, dateIndex, isMain) {
        let yesterday = this.dates[dateIndex - 1];

        let yesterdayPDI = this.pdi[yesterday];
        let todayPDI = this.pdi[date];
        let yesterdayNDI = this.ndi[yesterday];
        let todayNDI = this.ndi[date];

        let isCrossedUp = isCrossed(yesterdayPDI, todayPDI, yesterdayNDI, todayNDI, true);
        let isCrossedDown = isCrossed(yesterdayPDI, todayPDI, yesterdayNDI, todayNDI, false);
        let shouldBuy = isMain ? isCrossedUp : todayPDI > todayNDI;
        if (this.graph[date] > this.threshold && shouldBuy) {
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