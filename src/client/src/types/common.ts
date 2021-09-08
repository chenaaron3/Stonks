export interface GenericObject {
    /**
     * Can have any key string and any value type
     */
    [key: string]: any;
}

export type ValueOf<T> = T[keyof T];

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
export interface PassportUserData {
    username: string
}

export interface AlpacaCredentialsData {
    id: string;
    key: string;
    paper?: boolean;
}

export interface UserData {
    backtestIDs: SavedResultsData,
    alpaca: AlpacaCredentialsData;
    tradeSettings: {
        [key: string]: TradeSettingsData;
    }
}

export interface ClosedOrdersData {
    [key: string]: ClosedOrderData[]
}

export interface ClosedOrderData {
    buyPrice?: number;
    buyDate?: Date;
    sellPrice?: number;
    sellDate?: Date;
}

export interface BoughtSymbolData {
    [key: string]: BuyEntryData[];
}

export interface BuyEntryData {
    price: number;
    date: Date;
}

export interface TradeSettingsData {
    scoreBy?: SortBy;
    maxRisk?: string;
    maxPositions?: string;
}

export interface ExportLogin {
    username: string;
    password: string;
}

export interface SimulateSettingsData {
    range: number;
    startSize: number;
    maxPositions: number;
    positionSize: number;
    maxRisk: number;
    scoreBy: SortBy;
    risk: number;
    sizeOnRisk: boolean;
}

/**
 * Backtest Data
 */
export type SavedResultsData = BacktestID[];

export interface BacktestID {
    id: string;
    display: string;
}

export interface PivotsData {
    [key: string]: PivotData
}

export interface PivotData {
    type: 'high' | 'low';
    date: string;
    price: number;
    realized: string;
}

/**
 * Chart Data
 */
export interface SimulateChartData {
    date: number;
    value: number;
}

export interface SimulateReturnsData {
    year: number;
    startingEquity: number;
    returns?: number;
}

/**
 * Unions
 */
export type Timeframe = "1Hour" | "1Day";
export type ExportType = 'StocksTracker' | 'Finviz';
export type SortBy = 'Percent Profit' | 'Win Rate' | 'Dollar Profit';