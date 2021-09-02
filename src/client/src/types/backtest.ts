import Indicator from './indicator';
import { Timeframe } from './common';

namespace Backtest {
    /** Backtest Results */
    export interface ResultsRoot {
        results: ResultsData;
        summary: SummaryData;
        status: string;
    }

    export interface ResultsData {
        strategyOptions: StrategyOptions;
        symbolData: SymbolData;
        lastUpdated: Date;
        created: Date;
    }

    export interface SymbolData {
        [key: string]: SymbolDataEntry
    }

    export interface SymbolDataEntry {
        profit: number;
        percentProfit: number;
        faulty: boolean;
        events: EventData[];
        holdings: HoldingData[];
    }

    export interface EventData {
        reason: string;
        profit: number;
        percentProfit: number;
        buyDate: string;
        sellDate: string;
        span: number;
        symbol: string;
        index: number;
        score: EventScoreData;
        risk?: number;
    }

    export interface EventScoreData {
        "Percent Profit": number;
        "Dollar Profit": number;
        "Win Rate": number;
    }

    export interface HoldingData {
        buyDate: string;
        stoplossTarget: StoplossTargetData;
    }

    export interface StoplossTargetData {
        initStoploss?: number;
        stoploss?: number;
        target?: number;
        risk?: number;
        midPoint?: number;
        midPointReached?: boolean;
    }

    export interface StrategyOptions {
        buyIndicators: Indicator.Indicators;
        sellIndicators: Indicator.Indicators;
        mainBuyIndicator: keyof (Indicator.Indicators);
        mainSellIndicator: keyof (Indicator.Indicators);
        minVolume: number;
        maxDays: number;
        expiration: number;
        multipleBuys: boolean;
        timeframe: Timeframe;
        highPeriod: number;
        stopLossAtr?: number;
        riskRewardRatio?: number;
        limitOrder?: boolean;
        trailingStopLoss?: boolean;
        stoplossSwing?: boolean;
    }

    export interface SummaryData {
        equity: number;
        sharpe: number;
        weightedReturns: number;
    }

    /** Optimize */

    export interface OptimizeRoot {
        [key: string]: OptimizeData;
    }

    export interface OptimizeData {
        data: OptimizeEventData[];
        fields: string[];
    }

    export interface OptimizeEventData {
        indicators: number[];
        percentProfit: number;
        buyDate: string;
    }

    export interface OptimizeOptions {
        startStoploss: number;
        endStoploss: number;
        strideStoploss: number;
        startRatio: number;
        endRatio: number;
        strideRatio: number;
    }

    export interface OptimizeStoplossTargetResults {
        [key: string]: {
            summary: Backtest.SummaryData;
            strategyOptions: Backtest.StrategyOptions
        }
    }
}

export default Backtest;