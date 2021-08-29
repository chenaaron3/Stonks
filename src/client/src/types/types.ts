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