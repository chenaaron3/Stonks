// indicators
import SMA from './indicators/sma';
import EMA from './indicators/ema';
import RSI from './indicators/rsi';
import MACD from './indicators/macd';
import MACD2 from './indicators/macd2';
import GC from './indicators/gc';
import ADX from './indicators/adx';
import Solid from './indicators/solid';
import Candle from './indicators/candle';
import Structure from './indicators/structure';
import ATR from './indicators/atr';
import Pullback from './indicators/pullback';
import Breakout from './indicators/breakout';
import Divergence from './indicators/divergence';
import Stochastic from './indicators/stochastic';
import Trend from './indicators/trend';
import High from './indicators/high';
import Indicator from './indicators/indicator';

import IndicatorType from '@shared/indicator';
import { StockData } from '@shared/common';

let INDICATOR_OBJECTS = {
    "SMA": SMA,
    "EMA": EMA,
    "RSI": RSI,
    "MACD": MACD,
    "MACD2": MACD2,
    "GC": GC,
    "ADX": ADX,
    "Solid": Solid,
    "Candle": Candle,
    "Structure": Structure,
    "ATR": ATR,
    "Pullback": Pullback,
    "Breakout": Breakout,
    "Divergence": Divergence,
    "Stochastic": Stochastic,
    "Trend": Trend,
    "High": High
}

// gets an indicator object
function getIndicator(indicatorName: IndicatorType.IndicatorNames, indicatorOptions: IndicatorType.IndicatorParams, symbol: string, dates: string[],
    prices: StockData, opens: StockData, highs: StockData, lows: StockData, closes: StockData) {
    let indicator = new INDICATOR_OBJECTS[indicatorName](symbol, dates, prices, opens, highs, lows, closes);
    (indicator as Indicator).initialize(indicatorOptions);
    return indicator;
}

export { getIndicator };