import yahooFinance from 'yahoo-finance';

import { Timeframe, BarData } from '@shared/common';

function getYahooBars(symbol: string, startDate: Date, endDate: Date, timeframe: Timeframe) {
    return new Promise<BarData[]>((resolve, reject) => {
        yahooFinance.historical({
            symbol: symbol,
            from: startDate,
            to: endDate,
            period: 'd'  // 'd' (daily), 'w' (weekly), 'm' (monthly), 'v' (dividends only)
        }).then(bars => {
            let transformed: BarData[] = [];
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

export { getYahooBars };