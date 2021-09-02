import Indicator from './indicator';

export interface DrawerState {
    anchor: 'top' | 'bottom' | 'left' | 'right';
    open: boolean
}

export interface ChartSettingsData {
    'Candles': boolean;
    'Support Lines': boolean;
    'Test Mode': boolean;
}

export interface RouteMatchParams {
    backtestID: string;
}

export interface IndicatorGraphProps {
    graph:  IndicatorGraphData;        
    xAxisTickFormatter: (value: string) => string;
    brush: JSX.Element;
    tooltip: JSX.Element;
    options?: Indicator.IndicatorParams;
    width?: number;
    height?: number;
}

export type IndicatorGraphNames = 'RSI' | 'MACD' | 'ADX' | 'Stochastic';
export type IndicatorGraphsData = {
    [Property in IndicatorGraphNames]?: IndicatorGraphData
}
export type IndicatorGraphData = IndicatorGraphEntry[];
export interface IndicatorGraphEntry {
    date: string;
    values: {
        [key: string]: number;
    }
}