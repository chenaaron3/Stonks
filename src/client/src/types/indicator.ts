
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

    export interface BaseIndicatorParams {
        [key: string]: number;
    }

    export interface ADXParams extends BaseIndicatorParams {
        period: number;
        threshold: number;
    }

    export interface ATRParams extends BaseIndicatorParams{
        period: number;
    }

    export interface BreakoutParams extends BaseIndicatorParams{
        period: number;
        tests: number;
    }

    export interface CandleParams extends BaseIndicatorParams{
        expiration: number;
    }

    export interface DivergenceParams extends BaseIndicatorParams{
        period: number;
        lookback: number;
    }

    export interface EMAParams extends BaseIndicatorParams{
        period: number;
        minDuration: number;
    }

    export interface GCParams extends BaseIndicatorParams{
        ma1Period: number;
        ma2Period: number;
    }

    export interface HighParams extends BaseIndicatorParams{
        period: number;
    }

    export interface MACDParams extends BaseIndicatorParams{
        ema1: number;
        ema2: number;
        signalPeriod: number;
    }

    export interface MACD2Params extends BaseIndicatorParams{
        ema1: number;
        ema2: number;
        signalPeriod: number;
        buyThreshold: number;
    }

    export interface PullbackParams extends BaseIndicatorParams{
        period: number;
        length: number;
    }

    export interface RSIParams extends BaseIndicatorParams{
        period: number;
        underbought: number;
        overbought: number;
    }

    export interface SMAParams extends BaseIndicatorParams{
        period: number;
        minDuration: number;
    }

    export interface SolidParams extends BaseIndicatorParams{
        minLength: number;
        maxRatio: number;
    }

    export interface StochasticParams extends BaseIndicatorParams{
        period: number;
        underbought: number;
        overbought: number;
    }

    export interface StructureParams extends BaseIndicatorParams{
        period: number;
        volatility: number;
        minCount: number;
    }

    export interface SwingParams extends BaseIndicatorParams{
        period: number;
    }

    export interface TrendParams extends BaseIndicatorParams{
        period: number;
        lookback: number;
    }

    type ValueOf<T> = T[keyof T];
    export type IndicatorParams = ValueOf<Indicators>;

    export type IndicatorNames = keyof Indicators;
}

export default Indicator;