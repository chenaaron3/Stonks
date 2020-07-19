class Indicator {
	constructor(symbol, dates, prices) {
		this.symbol = symbol;
		this.dates = dates;
		this.prices = prices;
	}

	// initializes parameters and calculates graph
	initialize() {

	}

	// private method -- SHOULD BE OVERIDDEN
	calculate() {
		console.log("THIS SHOULD NOT BE PRINTED -- UH OH");
	}

	getAction(date) {

	}
}

Indicator.BUY = "BUY";
Indicator.SELL = "SELL";
Indicator.NOACTION = "NO ACTION";

module.exports = Indicator;