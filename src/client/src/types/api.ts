import { AlpacaAccount, AlpacaOrder, AlpacaPosition } from '@alpacahq/alpaca-trade-api';
import Backtest from './backtest';
import {
    BarData, Timeframe, BoughtSymbolData, StockData, ValueOf,
    PivotsData, ExportLogin, PassportUserData, UserData
} from './common';
import Indicator from './indicator';

export interface ErrorResponse {
    error: string;
}

namespace API {
    export namespace Alpaca {
        export interface Get { }
        export type _Get = AlpacaAccount;

        export interface GetClosedOrders { }
        export type _GetClosedOrders = AlpacaOrder[];

        export interface GetOpenOrders { }
        export type _GetOpenOrders = AlpacaOrder[];

        export interface GetPositions { }
        export type _GetPositions = AlpacaPosition[];

        export interface PostOrder {
            symbol: string;
            buyPrice: number;
            positionSize: number;
            stoploss: number;
            target: number;
        }
        export type _PostOrder = AlpacaOrder;
    }

    export namespace Index {
        export interface PostAutoUpdate {
            id: string;
            subscribe: boolean;
        }
        export type _PostAutoUpdate = {
            status: string;
        } | ErrorResponse

        export interface GetIsAutoUpdate {
            id: string
        }
        export interface _GetIsAutoUpdate {
            found: boolean;
        }

        export type PostBacktest = Backtest.StrategyOptions;
        export interface _PostBacktest {
            id: string;
            status: string;
        }

        export interface PostOptimizeStoplossTarget extends Backtest.OptimizeOptions {
            id: string;
        }
        export type _PostOptimizeStoplossTarget = {
            id: string;
            status: string;
        } | ErrorResponse

        export interface PostOptimizeIndicators {
            id: string;
        }
        export type _PostOptimizeIndicators = {
            id: string;
            status: string;
        } | ErrorResponse

        export interface GetResults {
            id: string;
        }
        export type _GetResults = Backtest.ResultsData | ErrorResponse;

        export interface GetOptimizedStoplossTarget {
            id: string;
        }
        export type _GetOptimizedStoplossTarget = {
            id: string;
            results: Backtest.OptimizeStoplossTargetResults;
        } | ErrorResponse;

        export interface GetOptimizedIndicators {
            id: string
        }
        export type _GetOptimizedIndicators = Backtest.OptimizeRoot | ErrorResponse;

        export interface GetUpdateBacktest {
            id: string;
        }
        export type _GetUpdateBacktest = {
            status: string;
        } | ErrorResponse;

        export interface DeleteDeleteResults {
            id: string;
        }
        export type _DeleteDeleteResults = {
            status: string;
        } | ErrorResponse;
    }

    export namespace Mongo {
        export interface PurseReset {
            timeframe: Timeframe;
        }
        export interface _PurseReset {
            status: string;
        }

        export interface GetFill {
            timeframe: Timeframe;
        }
        export interface _GetFill {
            status: string;
        }

        export interface GetActions { }
        export interface _GetActions {
            status: string;
        }

        export interface GetUpdate {
            timeframe: Timeframe;
        }
        export interface _GetUpdate {
            status: string;
        }

        export interface GetPop {
            amount: string;
            timeframe: Timeframe;
        }
        export interface _GetPop {
            status: string;
        }

        export interface GetTrim {
            timeframe: Timeframe;
        }
        export interface _GetTrim {
            status: string;
        }

        export interface GetCheckSplit { }
        export interface _GetCheckSplit {
            status: string;
        }

        export interface GetFixFaulty { }
        export interface _GetFixFaulty {
            status: string;
        }

        export interface GetClearActiveResults { }
        export interface _GetClearActiveResults {
            status: string;
        }
    }

    export namespace Symbol {
        export interface GetLatestPrice {
            symbol: string;
        }
        export type _GetLatestPrice = BarData;

        export interface GetBoughtSymbols { }
        export type _GetBoughtSymbols = BoughtSymbolData;

        export interface GetBuySymbol {
            symbol: string;
        }
        export type _GetBuySymbol = BoughtSymbolData;

        export interface GetSellSymbol {
            symbol: string;
        }
        export type _GetSellSymbol = BoughtSymbolData;

        export interface PostIndicatorGraph {
            symbol: string;
            indicatorName: Indicator.IndicatorNames
            indicatorOptions: Indicator.IndicatorParams;
            timeframe: Timeframe;
        }
        export type _PostIndicatorGraph = Indicator.GraphData;

        export interface PostPriceGraph {
            symbol: string;
            indicators: Indicator.Indicators;
            timeframe: Timeframe;
        }
        export interface _PostPriceGraph {
            price: BarData[];
            indicators: {
                [key: string]: Indicator.GraphData;
            }
            atr: Indicator.GraphData;
            pivots: PivotsData;
            volumes: StockData;
        }
    }

    export namespace Users {
        export interface PostWatchlist {
            destination: 'StocksTracker' | 'Finviz';
            symbols: string[];
            login: ExportLogin;
            watchlist: string;
        }
        export interface _PostWatchlist {
            status: string;
        }

        export interface Get { }
        export type _Get = PassportUserData | ErrorResponse;

        export interface GetIsLoggedIn { }
        export interface _GetIsLoggedIn {
            isLoggedIn: boolean;
        }

        export interface PostLogin { }
        export type _PostLogin = {
            status: string;
        } | ErrorResponse

        export interface PostRegister {
            username: string;
            password: string;
        }
        export type _PostRegister = {
            status: string;
        } | ErrorResponse

        export interface GetLogout { }
        export interface _GetLogout {
            status: string;
        }

        export interface PostData {
            field: keyof UserData;
            value: ValueOf<UserData>;
        }
        export type _PostData = {
            status: string;
        } | ErrorResponse

        export interface GetData { }
        export type _GetData = UserData | ErrorResponse;
    }

    export namespace Pusher {
        export type PusherEvents = 'onResultsFinished' | 'onUpdateFinished' | 'onOptimizeFinished' | 'onOptimizeIndicatorsFinished' | 'onProgressUpdate'
            | 'onOptimizeProgressUpdate' | 'onOptimizeIndicatorsProgressUpdate';

        export interface OnResultsFinished {
            id: string;
        }

        export interface OnUpdateFinished {
            id: string;
        }

        export interface OnOptimizeFinished {
            id: string;
        }

        export interface OnOptimizeIndicatorsFinished {
            id: string;
        }

        export interface OnProgressUpdate {
            progress: number;
        }

        export interface OnOptimizeProgressUpdate {
            progress: number;
        }

        export interface OnOptimizeIndicatorsProgressUpdate {
            progress: number;
        }

        export type PusherMessages = OnResultsFinished | OnUpdateFinished | OnOptimizeFinished |
            OnOptimizeIndicatorsFinished | OnProgressUpdate | OnOptimizeProgressUpdate | OnOptimizeIndicatorsProgressUpdate;
    }
}

export default API;