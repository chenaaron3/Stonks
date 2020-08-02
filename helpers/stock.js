var yahooFinance = require('yahoo-finance');
var { updateStockInfo, getDocument } = require("./mongo");
let { formatDate, daysBetween } = require('../helpers/utils');

// update a price document if needed
function updateStock(doc, today) {
    return new Promise(async (resolve, reject) => {
        // get information from document
        let symbol = doc._id;
        let lastUpdated = doc.lastUpdated;
        console.log("\nChecking ", symbol, " for updates...");

        // if need an update
        if (daysBetween(new Date(lastUpdated), today) > 0) {
            console.log("Update needed!");
            let priceData = undefined;

            // try to get price data
            try {
                priceData = await getUpdatedPrices(doc._id, doc.lastUpdated);
            } catch (e) {
                console.log("Error! ", e);
            }

            // if succesfully retrieved data
            if (priceData != undefined) {
                console.log(`Update size: ${priceData.length}`);
                await updateStockInfo(doc._id, priceData);
            }
            resolve();
        }
        else {
            console.log("Already Updated!");
            resolve();
        }
    });
}

// Get price from external api
function getUpdatedPrices(symbol, startDate) {
    return new Promise((resolve, reject) => {
        try {
            yahooFinance.historical({
                symbol: symbol,
                from: formatDate(startDate),
                to: formatDate(new Date()),
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