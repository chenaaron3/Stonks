import { StockData } from '@shared/common';
import IndicatorType from '@shared/indicator';

abstract class Indicator {
	/**
	 * Store stock data
	 */
	symbol: string;
	dates: string[];
	prices: StockData;
	opens: StockData;
	highs: StockData;
	lows: StockData;
	closes: StockData;
	name = '';

	/**
	 * Enum constants for indicator actions
	 */
	static BUY: string = 'BUY';
	static SELL: string = 'SELL';
	static NOACTION: string = 'NO ACTION';
	static STOP: string = 'STOP';

	constructor(symbol: string, dates: string[], prices: StockData, opens: StockData, highs: StockData, lows: StockData, closes: StockData) {
		this.symbol = symbol;
		this.dates = dates;
		this.prices = prices;
		this.opens = opens;
		this.highs = highs;
		this.lows = lows;
		this.closes = closes;
	}

	// initializes parameters and calculates graph
	abstract initialize(options: IndicatorType.IndicatorParams): void;

	// private method -- SHOULD BE OVERIDDEN
	abstract calculate(): any;

	abstract getGraph(): IndicatorType.GraphData;

	abstract getAction(date: string, dateIndex: number, isMain: boolean): string;

	abstract getValue(date: string): number | { [key: string]: number };

	abstract normalize(data: number[]): number[];
}

export = Indicator;