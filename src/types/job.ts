import Backtest from '@shared/backtest';
import Indicator from '@shared/indicator';
import { Timeframe } from '@shared/common';
import { MongoPrices, MongoResults } from '../types/types'

export interface StartBacktestRequest {
    type: 'startBacktest';
    id: string;
    strategyOptions: Backtest.StrategyOptions;
}

export interface BacktestJobRequest {
    type: 'backtestJob';
    partition: string[];
    id: string;
    previousResults: MongoResults;
    strategyOptions: Backtest.StrategyOptions;
}

export interface BacktestMessage {
    status: 'finished';
    intersections: Backtest.SymbolData;
}

export interface StartOptimizeStoplossTargetRequest {
    type: 'startOptimizeStoplossTarget';
    id: string;
    optimizeOptions: Backtest.OptimizeOptions;
}

export interface OptimizeStoplossTargetJobRequest {
    type: 'optimizeStoplossTargetJob';
    partition: string[];
    id: string;
    previousResults: MongoResults;
    optimizeOptions: Backtest.OptimizeOptions;
}

export interface OptimizeStoplossTargetMessage {
    status: 'finished';
    optimizedData: { [key: string]: Backtest.SymbolDataEntry[] };
}

export interface StartOptimizeIndicatorsRequest {
    type: 'startOptimizeIndicators';
    id: string;
    indicatorOptions: Indicator.Indicators;
}

export interface OptimizeIndicatorsJobRequest {
    type: 'optimizeIndicatorsJob';
    id: string;
    partition: string[];
    previousResults: MongoResults;
    indicatorOptions: Indicator.Indicators;
}

export interface OptimizeIndicatorsMessage {
    status: 'finished';
    optimizedData: Backtest.OptimizeRoot;
}

export interface StartUpdateRequest {
    type: 'startUpdate';
    partition: MongoPrices[];
    updateID: string;
    timeframe: Timeframe;
}

export interface UpdateMessage {
    status: 'finished';
}

export interface StartSplitCheckRequest {
    type: 'startSplitCheck';
    partition: MongoPrices[];
    jobID: string;
}

export interface CheckSplitMessage {
    status: 'finished';
    changes: number;
}

export interface StartCreatingDatasetRequest {
    type: 'startCreatingDataset';
    partition: string[];
    id: string;
    result: MongoResults;
    window: number;
}

export interface CreateDatasetMessage {
    status: 'finished';
    features: number[][];
    labels: number[];
}

export interface ProgressMessage {
    status: 'progress';
    progress: number;
}

export type RequestMessages = StartBacktestRequest | BacktestJobRequest |
    StartOptimizeStoplossTargetRequest | OptimizeStoplossTargetJobRequest |
    StartOptimizeIndicatorsRequest | OptimizeIndicatorsJobRequest |
    StartUpdateRequest | StartSplitCheckRequest | StartCreatingDatasetRequest
    ;