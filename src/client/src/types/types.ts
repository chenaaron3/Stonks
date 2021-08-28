import { RouteComponentProps } from 'react-router';

export interface DrawerState {
    anchor: 'top' | 'bottom' | 'left' | 'right';
    open: boolean
}

export interface ChartSettingsData {
    'Candles': boolean;
    'Support Lines': boolean;
    'Test Mode': boolean;
}

interface MatchParams {
    backtestID: string;
}

export interface BacktestPageProps extends RouteComponentProps<MatchParams> {
}