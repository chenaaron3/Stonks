import { BarData, BoughtSymbolData, UserData } from '@shared/common';
import Backtest from '@shared/backtest';

export interface GenericObject {
    /**
     * Can have any key string and any value type
     */
    [key: string]: any;
}

/**
 * User Data
 */
// req.session
declare module 'express-session' {
    export interface SessionData {
        /**
         * Store custom data in passport
         */
        username: string;
        buys: BoughtSymbolData;
    }
}

/**
 * Mongo
 */
export type COLLECTION_NAMES = 'accounts' | 'indicators' | 'metadata' | 'results' | 'sessions' | 'users' | `prices1Hour` | 'prices1Day';

export interface MongoDocumentData {
    _id: string;
    _fragmentData?: MongoFragmentData;
    [key: string]: any;
}

export interface MongoFragmentData {
    field: string;
    options: MongoSplitOptions;
    type: 'object' | 'array';
    ids: string[];
}

export interface MongoSplitOptions {
    subField: string;
}

export interface MongoResults extends Backtest.ResultsRoot, MongoDocumentData {
    _optimized?: {
        base: string;
        ids?: string[];
    }
}

export interface MongoPrices extends MongoDocumentData {
    prices: BarData[];
    lastUpdated: Date | string;
}

export interface MongoUser extends UserData, MongoDocumentData {}

export interface MongoActiveResults extends MongoDocumentData {
    activeResults: ActiveResultData[];
}

export interface ActiveResultData {
    id: string;
    email: string
}

export interface MongoIndicators extends MongoDocumentData {
    data: Backtest.OptimizeRoot;
}