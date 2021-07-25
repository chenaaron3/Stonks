// indicators
let SMA = require('./indicators/sma');
let EMA = require('./indicators/ema');
let RSI = require('./indicators/rsi');
let MACD = require('./indicators/macd');
let MACDPos = require('./indicators/macdPos');
let GC = require('./indicators/gc');
let ADX = require('./indicators/adx');
let Solid = require('./indicators/solid');
let Candle = require('./indicators/candle');
let Structure = require('./indicators/structure');
let ATR = require('./indicators/atr');
let Pullback = require('./indicators/pullback');
let Breakout = require('./indicators/breakout');
let Swing = require('./indicators/swing');
let Divergence = require('./indicators/divergence');
let Stochastic = require('./indicators/stochastic');
let Trend = require('./indicators/trend');
let High = require('./indicators/high');
let INDICATOR_OBJECTS = {
    "SMA": SMA,
    "EMA": EMA,
    "RSI": RSI,
    "MACD": MACD,
    "MACD2": MACDPos,
    "GC": GC,
    "ADX": ADX,
    "Solid": Solid,
    "Candle": Candle,
    "Structure": Structure,
    "ATR": ATR,
    "Pullback": Pullback,
    "Breakout": Breakout,
    "Swing": Swing,
    "Divergence": Divergence,
    "Stochastic": Stochastic,
    "Trend": Trend,
    "High": High
}

// gets an indicator object
function getIndicator(indicatorName, indicatorOptions, symbol, dates, prices, opens, highs, lows, closes) {
    let indicator = new INDICATOR_OBJECTS[indicatorName](symbol, dates, prices, opens, highs, lows, closes);
    indicator.initialize(indicatorOptions);
    return indicator;
}

module.exports = { getIndicator };