import Indicator from './indicator';

export interface GenericObject {
    /**
     * Can have any key string and any value type
     */
    [key: string]: any;
}

/** Bars */
export interface BarData {
    date: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

/**
 * Maps date string to statistic
 */
export interface StockData {
    [key: string]: number;
}

/**
 * User Data
 */
export interface BoughtSymbolData {
    [key: string]: BuyEntryData[];
}

export interface BuyEntryData {
    price: number;
    date: string;
}

export interface BacktestID {
    id: string;
    display: string;
}

export type Timeframe = "1Hour" | "1Day";

export type SortBy = 'Percent Profit' | 'Win Rate' | 'Dollar Profit';

export type PusherEvents = 'onResultsFinished' | 'onUpdateFinished' | 'onOptimizeFinished' | 'onOptimizeIndicatorsFinished' | 'onProgressUpdate' | 'onOptimizeProgressUpdate' | 'onOptimizeIndicatorsProgressUpdate'