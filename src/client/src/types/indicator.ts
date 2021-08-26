
namespace Indicator {
    export interface Indicators {
        ADX?: ADXParams;
        ATR?: ATRParams;
        Breakout?: BreakoutParams;
        Candle?: CandleParams;
        Divergence?: DivergenceParams;
        EMA?: EMAParams;
        GC?: GCParams;
        High?: HighParams;
        MACD?: MACDParams;
        MACD2?: MACD2Params;
        Pullback?: PullbackParams;
        RSI?: RSIParams;
        SMA?: SMAParams;
        Solid?: SolidParams;
        Stochastic?: StochasticParams;
        Structure?: StructureParams;
        Swing?: SwingParams;
        Trend?: TrendParams;    
    }

    export interface ADXParams {
        period: number;
        threshold: number;
    }

    export interface ATRParams {
        period: number;
    }

    export interface BreakoutParams {
        period: number;
        tests: number;
    }

    export interface CandleParams {
        expiration: number;
    }

    export interface DivergenceParams {
        period: number;
        lookback: number;
    }

    export interface EMAParams {
        period: number;
        minDuration: number;
    }

    export interface GCParams {
        ma1Period: number;
        ma2Period: number;
    }

    export interface HighParams {
        period: number;
    }

    export interface MACDParams {
        ema1: number;
        ema2: number;
        signalPeriod: number;
    }

    export interface MACD2Params {
        ema1: number;
        ema2: number;
        signalPeriod: number;
        buyThreshold: number;
    }

    export interface PullbackParams {
        period: number;
        length: number;
    }

    export interface RSIParams {
        period: number;
        underbought: number;
        overbought: number;
    }

    export interface SMAParams {
        period: number;
        minDuration: number;
    }

    export interface SolidParams {
        minLength: number;
        maxRatio: number;
    }

    export interface StochasticParams {
        period: number;
        underbought: number;
        overbought: number;
    }

    export interface StructureParams {
        period: number;
        volatility: number;
        minCount: number;
    }

    export interface SwingParams {
        period: number;
    }

    export interface TrendParams {
        period: number;
        lookback: number;
    }

    type ValueOf<T> = T[keyof T];
    export type IndicatorParams = ValueOf<Indicators>;

    export type IndicatorNames = keyof Indicators;
}

export = Indicator;