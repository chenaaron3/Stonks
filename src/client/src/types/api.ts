import { AlpacaAccount, AlpacaOrder, AlpacaPosition } from '@alpacahq/alpaca-trade-api';
import Backtest from './backtest';

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

    }

    export namespace Symbol {

    }

    export namespace Users {
        
    }
}
export default API;