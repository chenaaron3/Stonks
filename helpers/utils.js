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
    let uts = {};
    let dts = {};
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
function getWilderSmoothing(dates, prices, period) {
    let res = {};
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

function getSwingPivots(dates, prices, period) {
    let pivots = {};
    let mode = "low";
    let swingDate = dates[0];

    for (let i = 0; i < dates.length; ++i) {
        let highLow = isHighLow(dates, prices, period, i);
        // if is a high
        if (highLow["high"]) {
            // mark previous low as official
            if (mode == "low") {
                // pivot is realized 1 day after
                pivots[swingDate] = { type: "low", price: prices[swingDate], realized: dates[Math.min(i + 1, dates.length - 1)] };
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
                pivots[swingDate] = { type: "high", price: prices[swingDate], realized: dates[Math.min(i + 1, dates.length - 1)] };
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

function isHighLow(dates, prices, period, dateIndex) {
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

function getStochasticOscillator(dates, lows, prices, highs, period) {
    let res = {};

    for (let i = 0; i < dates.length; ++i) {
        let low = getLow(dates, lows, period, i);
        let high = getHigh(dates, highs, period, i);
        res[dates[i]] = ((prices[dates[i]] - low) / (high - low)) * 100;
    }

    return res;
}

function getHigh(dates, prices, period, dateIndex) {
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

function getLow(dates, prices, period, dateIndex) {
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

score = (events, index, scoreData) => {
    let mainEvent = events[index];
    let wins = scoreData["wins"];
    let count = scoreData["count"];
    let score = { "Percent Profit": scoreData["percentProfit"] * count, "Dollar Profit": scoreData["dollarProfit"] * count, "Win Rate": 0 };

    // new stock
    if (index == 0) return score;

    let newRealizedIndex = scoreData["realizedIndex"];
    for (let i = scoreData["realizedIndex"] + 1; i < index; ++i) {
        let event = events[i];
        if (new Date(event["sellDate"]) > new Date(mainEvent["buyDate"])) {
            break;
        }

        newRealizedIndex = i;
        score["Percent Profit"] += event["percentProfit"];
        score["Dollar Profit"] += event["profit"];

        if (event["percentProfit"] > 0) {
            wins += 1;
        }
        count += 1;
    }
    if (count > 0) {
        score["Percent Profit"] /= count;
        score["Dollar Profit"] /= count;
        score["Win Rate"] = wins / count;
    }

    scoreData["realizedIndex"] = newRealizedIndex;
    scoreData["count"] = count;
    scoreData["wins"] = wins;
    scoreData["percentProfit"] = score["Percent Profit"];
    scoreData["dollarProfit"] = score["Dollar Profit"];

    return score;
}

function simulateBacktest(state, results) {
    let eventsByDate = {};
    let dates = new Set();
    let symbols = Object.keys(results["symbolData"]);
    symbols.forEach(symbol => {
        let events = results["symbolData"][symbol]["events"];
        let scoreData = { realizedIndex: -1, count: 0, wins: 0, percentProfit: 0, dollarProfit: 0 };
        for (let i = 0; i < events.length; ++i) {
            let event = events[i];
            // store symbol and index for future reference
            event["symbol"] = symbol;
            event["index"] = i;
            event["score"] = score(events, i, scoreData);
            let buyDate = new Date(event["buyDate"]).getTime();
            let sellDate = new Date(event["sellDate"]).getTime();
            if (!dates.has(buyDate)) {
                dates.add(buyDate);
            }
            if (!dates.has(sellDate)) {
                dates.add(sellDate);
            }
            if (!eventsByDate.hasOwnProperty(buyDate)) {
                eventsByDate[buyDate] = [];
            }
            eventsByDate[buyDate].push(event);
        };
    });

    // sort the dates to simulate
    dates = [...dates];
    dates.sort((a, b) => {
        return new Date(parseInt(a)) - new Date(parseInt(b))
    });

    // start simulation
    let equity = state.startSize;
    let buyingPower = equity;
    let equityData = []; // equity after reach trade
    let returnsData = []; // percent annual returns
    let transactions = {}; // maps year to list of events
    let holdings = [];
    let startDate = new Date();
    let start = false;
    startDate.setFullYear(startDate.getFullYear() - state.range);
    for (let i = 0; i < dates.length; ++i) {
        let date = dates[i];

        // check start
        if (!start) {
            // past start
            if (new Date(parseInt(date)) > startDate) {
                start = true;
            }
            // keep searching
            else {
                continue;
            }
        }

        // if looking for buyers
        if (holdings.length < state.maxPositions) {
            let events = eventsByDate[date];
            if (events) {
                events.sort((a, b) => b["score"][state.scoreBy] - a["score"][state.scoreBy]);
                // keep buying until holdings maxed
                for (let i = 0; i < events.length; ++i) {
                    let event = events[i];

                    // check for risk
                    if (event["risk"] && event["risk"] > state.maxRisk) {
                        continue;
                    }

                    // add event to transactions
                    let d = new Date();
                    d.setTime(date);
                    let y = d.getFullYear();
                    if (!transactions.hasOwnProperty(y)) {
                        transactions[y] = [];
                    }
                    transactions[y].push(event);

                    // Calculate buy amount
                    event["buyAmount"] = equity * (state.positionSize / 100);

                    // check if have enough money to buy
                    event["buyAmount"] = Math.min(event["buyAmount"], buyingPower);
                    // deduct from buying power
                    buyingPower -= event["buyAmount"];

                    // add to holdings
                    holdings.push(event);

                    // stop buying if max out on holdings or ran out of money
                    if (holdings.length >= state.maxPositions || buyingPower == 0) {
                        break;
                    }
                }
            };
        }

        // check sells
        let sold = [];
        holdings.forEach(holding => {
            let sellDate = new Date(holding["sellDate"]);
            // time to sell
            if (date == sellDate.getTime()) {
                sold.push(holding);
                equity += holding["buyAmount"] * (holding["percentProfit"]);
                buyingPower += holding["buyAmount"] * (1 + holding["percentProfit"]);

                // start over in case we bust account
                if (equity <= 0) {
                    equity = state.startSize;
                }
            }
        })
        holdings = holdings.filter(h => !sold.includes(h));

        equityData.push({ date: date, equity });
    }

    // sell off all holdings
    let last = equityData[equityData.length - 1];
    holdings.forEach(holding => {
        equity += holding["buyAmount"] * (holding["percentProfit"]);
    })
    last["equity"] = equity;

    // calculate the returns for each year
    let currentYear = 0;
    equityData.forEach(ed => {
        let d = new Date();
        d.setTime(ed["date"]);
        let y = d.getFullYear();

        // first record of year
        if (y != currentYear) {
            // update last year's returns
            if (returnsData.length > 0) {
                let rd = returnsData[returnsData.length - 1];
                rd["returns"] = (ed["equity"] - rd["startingEquity"]) / rd["startingEquity"] * 100;
            }
            returnsData.push({ year: y, startingEquity: ed["equity"] });
        }

        // update current year
        currentYear = y;
    })

    // calculate returns for last year
    last = returnsData[returnsData.length - 1];
    if (!last.hasOwnProperty("returns")) {
        last["returns"] = (equityData[equityData.length - 1]["equity"] - last["startingEquity"]) / last["startingEquity"] * 100;
    }

    // get the weighted score for returns
    let weightedReturns = 0;
    let totalWeight = 0;
    let weight = 1;
    let deltaWeight = .1;
    for (let i = 0; i < returnsData.length; ++i) {
        weightedReturns += weight * returnsData[i]["returns"];
        totalWeight += weight;
        weight += deltaWeight;
    }
    weightedReturns /= totalWeight;

    return { equity, weightedReturns };
}

function getBacktestSummary(results) {
    let winSpan = 0;
    let lossSpan = 0;
    let winProfit = 0;
    let lossProfit = 0;
    let winPercentProfit = 0;
    let lossPercentProfit = 0;
    let numWins = 0;
    let numLosses = 0;

    let symbols = Object.keys(results["symbolData"]);
    symbols.forEach(symbol => {
        results["symbolData"][symbol]["events"].forEach(event => {
            if (Math.abs(event["profit"]) > 100000) {
                return;
            }

            if (event["profit"] < 0) {
                numLosses += 1;
                lossSpan += event["span"];
                lossProfit += event["profit"];
                lossPercentProfit += event["percentProfit"];
            }
            else if (event["profit"] > 0) {
                numWins += 1;
                winSpan += event["span"];
                winProfit += event["profit"];
                winPercentProfit += event["percentProfit"];
            }
        })
    })

    // span adjustments
    winSpan /= numWins;
    winSpan = Math.floor(winSpan);
    lossSpan /= numLosses;
    lossSpan = Math.floor(lossSpan);

    // percent profit adjustments
    winPercentProfit /= numWins;
    winPercentProfit = (100 * winPercentProfit);
    lossPercentProfit /= numLosses;
    lossPercentProfit = (100 * lossPercentProfit);

    let winRate = (numWins) / (numWins + numLosses);
    let annualWinPercentProfit = winPercentProfit * 360 / winSpan * (winRate);
    let annualLossPercentProfit = lossPercentProfit * 360 / lossSpan * (1 - winRate);

    return {
        profit: (winProfit + lossProfit),
        percentProfit: (annualWinPercentProfit + annualLossPercentProfit),
        ...simulateBacktest({
            range: 50, startSize: 1, maxPositions: 20, positionSize: 5, maxRisk: 100,
            scoreBy: "Win Rate",
        }, results)
    }
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
    isCrossed, getSimpleMovingAverage, getRSI, getWilderSmoothing, getMACD, getExponentialMovingAverage, getTrueRange, getDirectionalMovement, getSwingPivots, isHighLow, getStochasticOscillator,
    formatDate, hoursBetween, daysBetween, sameDay, toPST, makeid, normalizeRange, clampRange, shallowEqual, simulateBacktest, getBacktestSummary
};