class Indicator {
	constructor(symbol, dates, prices, opens, highs, lows, closes) {
		this.symbol = symbol;
		this.dates = dates;
		this.prices = prices;
		this.opens = opens;
		this.highs = highs;
		this.lows = lows;
		this.closes = closes;
	}

	// initializes parameters and calculates graph
	initialize() {

	}

	// private method -- SHOULD BE OVERIDDEN
	calculate() {
		console.log("THIS SHOULD NOT BE PRINTED -- UH OH");
	}

	getAction(date, dateIndex) {

	}
}

Indicator.BUY = "BUY";
Indicator.SELL = "SELL";
Indicator.NOACTION = "NO ACTION";
Indicator.STOP = "STOP";

module.exports = Indicator;