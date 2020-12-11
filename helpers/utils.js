// determine if line (x1, a1) => (x2, a2) crosses line (x1, b1) => (x2, b2)
function isCrossed(a1, a2, b1, b2, crossUp) {
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
function getSimpleMovingAverage(dates, prices, period) {
    let res = {};
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

function getRSI(dates, prices, period) {
    let res = {};
    // get wilder averages
    let avgU = getWilderSmoothing(dates, prices, period, true);
    let avgD = getWilderSmoothing(dates, prices, period, false);

    // if both valid
    if (avgU["valid"] && avgD["valid"]) {
        // start storing the RSI
        let startIndex = dates.indexOf(avgU["start"]);
        for (let i = startIndex; i < dates.length; ++i) {
            let day = dates[i];
            let rs = avgU["data"][day] / avgD["data"][day];
            res[day] = 100 - (100 / (1 + rs));
        }
    }
    return res;

}

// gets a list of points (date, price) for Wilder's smoothing average
function getWilderSmoothing(dates, prices, period, up) {
    let res = {};
    let sum = 0;
    let start = undefined;
    let avg = 0;
    // go through each date
    for (let i = 1; i < dates.length; ++i) {
        let yesterday = dates[i - 1];
        let day = dates[i];
        let ut = prices[day] - prices[yesterday];
        let dt = prices[yesterday] - prices[day];
        ut = ut > 0 ? ut : 0;
        dt = dt > 0 ? dt : 0;
        // if not enough for moving sum, keep adding
        if (i < period) {
            if (up) {
                sum += ut;
            }
            else {
                sum += dt;
            }
        }
        // start saving moving sum
        else {
            if (i == period) {
                start = day;
                avg = sum / period;
            }
            if (up) {
                avg = avg * ((period - 1) / period) + ut * (1 / period);
            }
            else {
                avg = avg * ((period - 1) / period) + dt * (1 / period);
            }
            res[day] = avg;
        }
    }
    return { valid: start != undefined, start: start, data: res };
}

function getMACD(dates, prices, ema1period, ema2period) {
    let res = {};
    // get exponential averages
    ema1 = getExponentialMovingAverage(dates, prices, ema1period);
    ema2 = getExponentialMovingAverage(dates, prices, ema2period);

    // if both valid
    if (ema1["valid"] && ema2["valid"]) {
        // start storing the differences
        let startIndex = dates.indexOf(ema2["start"]);
        for (let i = startIndex; i < dates.length - 1; ++i) {
            let day = dates[i];
            res[day] = ema1["data"][day] - ema2["data"][day];
        }
    }
    return res;
}

// gets a list of points (date, price) for exponential moving average
function getExponentialMovingAverage(dates, prices, period) {
    let res = {};
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

function getTrueRange(dates, highs, lows, closes) {
    let res = {};
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

function getDirectionalMovement(dates, highs, lows, positive) {
    let res = {};
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

// format date to api needs
function formatDate(date) {
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

function hoursBetween(dt1, dt2) {
    var diff = (dt2.getTime() - dt1.getTime()) / 1000;
    diff /= (60 * 60);
    return Math.round(diff);
}

function daysBetween(date1, date2) {
    // The number of milliseconds in one day
    const ONE_DAY = 1000 * 60 * 60 * 24;
    // Calculate the difference in milliseconds
    const differenceMs = Math.abs(date1 - date2);
    // Convert back to days and return
    return Math.round(differenceMs / ONE_DAY);
}

function sameDay(d1, d2) {
    return d1.getFullYear() == d2.getFullYear() && d1.getMonth() == d2.getMonth() && d1.getDate() == d2.getDate();
}

function toPST(date) {
    var utcDate = new Date(date.toUTCString());
    utcDate.setHours(utcDate.getHours() - 8);
    return new Date(utcDate);
}

function makeid(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

// used for 0-1
function clampRange(data) {
    if (data.length <= 1) {
        return data;
    }

    let min = Math.min(...data);
    let max = Math.max(...data);
    let res = [];
    data.forEach(d => {
        res.push((d - min) / (max - min));
    })
    return res;
}

// used for pos and neg
function normalizeRange(data) {
    let res = [];
    let sd = getStandardDeviation(data);
    let mean = getMean(data);
    data.forEach(d => {
        res.push((d - mean) / (sd));
    })
    return res;
}

function getStandardDeviation(array) {
    const n = array.length
    const mean = array.reduce((a, b) => a + b) / n
    return Math.sqrt(array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n)
}

function getMean(array) {
    const n = array.length;
    const mean = array.reduce((a, b) => a + b) / n;
    return mean;
}

function shallowEqual(object1, object2) {
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

module.exports = {
    isCrossed, getSimpleMovingAverage, getRSI, getMACD, getExponentialMovingAverage, getTrueRange, getDirectionalMovement,
    formatDate, hoursBetween, daysBetween, sameDay, toPST, makeid, normalizeRange, clampRange, shallowEqual
};