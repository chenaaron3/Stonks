// format date to api needs
function formatDate(date) {
    if (typeof date == "string") {
        date = new Date(date);
    }

    // add 1 day, data is off
    date.setDate(date.getDate() + 1);

    var year = date.getFullYear();

    var month = (1 + date.getMonth()).toString();
    month = month.length > 1 ? month : '0' + month;

    var day = date.getDate().toString();
    day = day.length > 1 ? day : '0' + day;

    return month + '/' + day + '/' + year % 100;
}

function daysBetween(date1, date2) {
    // The number of milliseconds in one day
    const ONE_DAY = 1000 * 60 * 60 * 24;
    // Calculate the difference in milliseconds
    const differenceMs = Math.abs(date1 - date2);
    // Convert back to days and return
    return Math.round(differenceMs / ONE_DAY);
}

function hoursBetween(dt1, dt2) {
    var diff = (dt2.getTime() - dt1.getTime()) / 1000;
    diff /= (60 * 60);
    return Math.round(diff);
}

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function camelToDisplay(s) {
    return s.replace(/([A-Z])/g, ' $1')
        .replace(/^./, function (str) { return str.toUpperCase(); });
}

function displayDelta(p) {
    return (p >= 0 ? "+" : "") + p.toFixed(2);
}

function getBacktestDisplayName(options) {
    let indicatorsUsed = new Set();
    Object.keys(options["buyIndicators"]).forEach(i => indicatorsUsed.add(i));
    Object.keys(options["sellIndicators"]).forEach(i => indicatorsUsed.add(i));
    indicatorsUsed = Array.from(indicatorsUsed);
    indicatorsUsed.sort();
    return indicatorsUsed.join("/");
}

const mapRange = (value, x1, y1, x2, y2) => (value - x1) * (y2 - x2) / (y1 - x1) + x2;

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

function findOptimalRisk(state, results) {
    let simulationResults = [];
    let scoreTypes = ["Win Rate", "Percent Profit"];
    // try combinations of settings
    scoreTypes.forEach(scoreBy => {
        for (let maxRisk = 5; maxRisk < 50; maxRisk += 5) {
            let { equity, sharpe, weightedReturns } = simulateBacktest({
                ...state, scoreBy, maxRisk
            }, results);
            simulationResults.push({
                metrics: { equity, sharpe, weightedReturns },
                settings: { scoreBy, maxRisk }
            });
            console.log("Trying risk", maxRisk);
        }
    });

    // find optimal combination
    let { optimalIndex } = findOptimalMetric(simulationResults.map(sr => sr["metrics"]));
    return simulationResults[optimalIndex];
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
            event["score"] = scoreEvent(events, i, scoreData);
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
                    // Metho1: calculate buy amount by account size
                    if (!state.sizeOnRisk || !event["risk"]) {
                        event["buyAmount"] = equity * (state.positionSize / 100);
                    }
                    // Method2: calculate buy amount by risk
                    else {
                        event["buyAmount"] = equity * (state.risk / 100) / (event["risk"] / 100);
                    }

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

    let returnsNumeric = returnsData.map(v => v["returns"]);
    let sharpe = getMean(returnsNumeric) / Math.sqrt(getStandardDeviation(returnsNumeric));

    return { transactions, equityData, returnsData, equity, weightedReturns, sharpe };
}

function scoreEvent(events, index, scoreData) {
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

// returns index of optimal metric
function findOptimalMetric(metrics) {
    if (metrics.length == 0) return -1;

    // find ranges of each metric
    let ranges = {};
    Object.keys(metrics[0]).forEach(metricName => {
        ranges[metricName] = {
            min: Math.min(...metrics.map(metric => metric[metricName])),
            max: Math.max(...metrics.map(metric => metric[metricName]))
        }
    });

    // find the score of each metric
    let scores = metrics.map(metric => Object.keys(metric)
        .map(metricName => mapRange(metric[metricName], ranges[metricName]["min"], ranges[metricName]["max"], 0, 1))
        .reduce((a, b) => a + b, 0));

    // console.log(metrics, ranges, scores);
    // index of max score
    let optimalIndex = scores.indexOf(Math.max(...scores));
    return {
        optimalIndex: optimalIndex,
        scores: scores
    };
}

module.exports = { formatDate, daysBetween, hoursBetween, numberWithCommas, camelToDisplay, displayDelta, getBacktestDisplayName, mapRange, simulateBacktest, findOptimalRisk, findOptimalMetric };