var yahooFinance = require('yahoo-finance');
const { toPST } = require('./utils')

function getYahooBars(symbol, startDate, endDate, timeframe) {
    return new Promise((resolve, reject) => {
        yahooFinance.historical({
            symbol: symbol,
            from: startDate,
            to: endDate,
            period: 'd'  // 'd' (daily), 'w' (weekly), 'm' (monthly), 'v' (dividends only)
        }).then(bars => {
            let transformed = [];
            bars.forEach(bar => {
                let date = new Date(bar["date"]);
                date.setHours(date.getHours() + 16); // to pst 1 pm
                let adjScale = bar["adjClose"] / bar["close"];
                let entry = {
                    date: date,
                    open: bar["open"] * adjScale,
                    high: bar["high"] * adjScale,
                    low: bar["low"] * adjScale,
                    close: bar["close"] * adjScale,
                    volume: bar["volume"]
                }
                transformed.unshift(entry);
            });
            resolve(transformed);
        })
            .catch(err => reject(err))
    })
}

module.exports = { getYahooBars };