var yahooFinance = require('yahoo-finance');
var { updateStockInfo, getDocument } = require("./mongo");
let { formatDate, daysBetween, hoursBetween } = require('../helpers/utils');

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
                let startDate = new Date("1/1/1500");
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
                    let previousDate = new Date("1/1/1500");
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

module.exports = { updateStock, getPrices }