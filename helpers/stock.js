var yahooFinance = require('yahoo-finance');
var { updateStockInfo, getDocument, getCollection } = require("./mongo");
let { formatDate, daysBetween, hoursBetween, clampRange } = require('./utils');
let { getIndicator } = require('./backtest');

// update a price document if needed
function updateStock(doc, updateDate) {
    return new Promise(async (resolve, reject) => {
        let forceUpdate = true;
        // get information from document
        let symbol = doc._id;
        let lastUpdated = new Date(doc.lastUpdated);

        // console.log(doc);
        // console.log("DIFF", hoursBetween(new Date(lastUpdated), updateDate));
        // if need an update
        if (hoursBetween(new Date(lastUpdated), updateDate) > 12 || forceUpdate) {
            let priceData = undefined;

            // try to get price data
            try {
                // get last recorded date
                let baseDate = process.env.NODE_ENV == "production" ? "1/1/2018" : "1/1/1500";
                let startDate = new Date(baseDate);
                if (doc.prices.length > 0) {
                    startDate = new Date(doc.prices[0]["date"])
                }
                // dont repeat last date
                startDate.setDate(startDate.getDate() + 1);
                priceData = await getUpdatedPrices(doc._id, startDate, updateDate);
            } catch (e) {
                console.log("Error! ", e);
            }

            // if succesfully retrieved data
            if (priceData != undefined) {
                console.log(`${symbol} update size: ${priceData.length}`);
                await updateStockInfo(doc._id, priceData, updateDate);
            }
            resolve();
        }
        else {
            resolve();
        }
    });
}

// Get price from external api
function getUpdatedPrices(symbol, startDate, endDate) {
    console.log(symbol, "update range:", startDate, "=>", endDate);
    return new Promise((resolve, reject) => {
        // update on same day
        if (endDate < startDate) {
            return resolve([]);
        }
        try {
            yahooFinance.historical({
                symbol: symbol,
                from: startDate,
                to: endDate,
                period: 'd'  // 'd' (daily), 'w' (weekly), 'm' (monthly), 'v' (dividends only)
            }, function (err, quotes) {
                if (err) reject(err);
                else {
                    // reverse for yahoo, want old to new
                    quotes = quotes.reverse();
                    // console.log("BEFORE:", quotes);
                    for (let i = 0; i < quotes.length; ++i) {
                        // remove updates that are out of range 
                        if (quotes[i]["date"] < startDate) {
                            quotes.shift();
                            --i;
                        }
                        else {
                            break;
                        }
                    }
                    // check last 3 results for repeats
                    let baseDate = process.env.NODE_ENV == "production" ? "1/1/2018" : "1/1/1500";
                    let previousDate = new Date(baseDate);
                    for (let i = Math.max(0, quotes.length - 3); i < quotes.length; ++i) {
                        if (quotes[i]["date"].getTime() == previousDate.getTime()) {
                            quotes.splice(i - 1, 1);
                            --i;
                        }
                        previousDate = quotes[i]["date"];
                    }
                    // console.log("AFTER:", quotes);
                    resolve(quotes);
                }
            });
        } catch (e) {
            reject(`Error: ${e}`);
        }
    });
}

async function getLatestPrice(symbol) {
    let priceCollection = await getCollection("prices");
    let stockInfo = await priceCollection.find({ _id: symbol }).project({ prices: { $slice: -1 } });
    stockInfo = await stockInfo.toArray();
    if (stockInfo.length > 0) {
        return stockInfo[0]["prices"][0];
    }
    else {
        return {};
    }
}

// Get price from own database
function getPrices(symbol) {
    return new Promise(async (resolve, reject) => {
        getDocument("prices", symbol)
            .then(document => {
                resolve(document.prices);
            })
            .catch(err => reject(err));
    });
}


// used for ml dataset
async function gatherData(symbols, result, window) {
    let backtestData = result["results"]["symbolData"];
    let features = [];
    let labels = [];
    for (let symbolIndex = 0; symbolIndex < symbols.length; ++symbolIndex) {
        let symbol = symbols[symbolIndex];
        console.log(symbol);

        // gather symbol data
        let symbolData = (await getDocument("prices", symbol))["prices"];
        let prices = {};
        let opens = {};
        let highs = {};
        let lows = {};
        let closes = {};
        for (let symbolDataIndex = 0; symbolDataIndex < symbolData.length; ++symbolDataIndex) {
            let day = symbolData[symbolDataIndex];
            let formattedDate = new Date(day["date"]).toISOString();
            prices[formattedDate] = day["adjClose"];
            opens[formattedDate] = day["open"];
            highs[formattedDate] = day["high"];
            lows[formattedDate] = day["low"];
            closes[formattedDate] = day["close"];
        }

        // get sorted dates
        let dates = Object.keys(prices).sort(function (a, b) {
            return new Date(a) - new Date(b);
        });

        // load indicator data
        let indicatorOptions = result["results"]["strategyOptions"]["buyIndicators"]
        let indicatorNames = Object.keys(indicatorOptions).sort();
        let indicators = {};
        for (let indicatorIndex = 0; indicatorIndex < indicatorNames.length; ++indicatorIndex) {
            let indicatorName = indicatorNames[indicatorIndex];
            let indicator = getIndicator(indicatorName, indicatorOptions[indicatorName], symbol, dates, prices, opens, highs, lows, closes);
            indicators[indicatorName] = indicator;
        }

        // populate data with events
        let events = backtestData[symbol]["events"];
        for (let eventIndex = 0; eventIndex < events.length; ++eventIndex) {
            let event = events[eventIndex];
            let buyDate = event["buyDate"];
            let buyIndex = dates.indexOf(buyDate);
            let startIndex = buyIndex - window + 1;
            if (startIndex < 0) {
                continue;
            }
            let feature = [];
            let priceFeatures = [];

            // add price data
            for (let i = startIndex; i <= buyIndex; ++i) {
                priceFeatures.push(prices[dates[i]]);
            }
            priceFeatures = clampRange(priceFeatures);
            feature = feature.concat(priceFeatures);

            // add indicator data
            for (let indicatorIndex = 0; indicatorIndex < indicatorNames.length; ++indicatorIndex) {
                let indicatorName = indicatorNames[indicatorIndex];
                let indicator = indicators[indicatorName];
                let indicatorFeatures = []
                // loop window size
                for (let i = startIndex; i <= buyIndex; ++i) {
                    indicatorFeatures.push(indicator.getValue(dates[i]));
                }
                // console.log(indicatorName, "Before", indicatorFeatures);
                // normalize the data
                indicatorFeatures = indicator.normalize(indicatorFeatures);
                // console.log(indicatorName, "After", indicatorFeatures);
                // add indicator features
                feature = feature.concat(indicatorFeatures);
            };

            // dont include falsy data
            if (feature.includes(null) || feature.includes(undefined) || feature.includes(NaN)) {
                continue;
            }
            else {
                // add to dataset
                features.push(feature);
                labels.push(event["profit"] > 0 ? 0 : 1);
            }
        }
    };
    return { features, labels };
}

module.exports = { updateStock, getPrices, gatherData, getUpdatedPrices, getLatestPrice }