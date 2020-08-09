var yahooFinance = require('yahoo-finance');
var { updateStockInfo, getDocument } = require("./mongo");
let { formatDate, daysBetween } = require('../helpers/utils');

// update a price document if needed
function updateStock(doc, updateDate) {
    return new Promise(async (resolve, reject) => {
        // get information from document
        let symbol = doc._id;
        let lastUpdated = new Date(doc.lastUpdated);

        // if need an update
        if (daysBetween(new Date(lastUpdated), updateDate) > 0) {
            let priceData = undefined;

            // try to get price data
            try {
                // dont repeat last date
                lastUpdated.setDate(lastUpdated.getDate() + 1);
                priceData = await getUpdatedPrices(doc._id, lastUpdated, updateDate);
                // reverse for yahoo finance
                priceData = priceData.reverse();
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
    return new Promise((resolve, reject) => {
        try {
            yahooFinance.historical({
                symbol: symbol,
                from: formatDate(startDate),
                to: formatDate(endDate),
                period: 'd'  // 'd' (daily), 'w' (weekly), 'm' (monthly), 'v' (dividends only)
            }, function (err, quotes) {
                if (err) reject(err);
                else {
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
            .catch (err => reject(err));
});
}

module.exports = { updateStock, getPrices }