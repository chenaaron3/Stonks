declare module '@alpacahq/alpaca-trade-api' {
    import { EventEmitter } from "events";

    export interface AlpacaParams {
        keyId: string;
        secretKey: string;
        paper?: boolean;
        baseUrl?: string;
        dataBaseUrl?: string;
        dataStreamUrl?: string;
        polygonBaseUrl?: string;
        apiVersion?: string;
        oauth?: string;
        usePolygon?: true | false; // should we use polygon data or alpaca data
        feed?: string; // use 'sip' if you have PRO subscription
        verbose?: boolean;
    }
    export interface GetAssetsParams {
        status: string;
        asset_class: string;
    }

    export interface Asset {
        symbol: string;
        asset_class: string;
        exchange: Exchange;
    }

    export const enum Exchange {
        AMEX = "AMEX",
        ARCA = "ARCA",
        BATS = "BATS",
        NYSE = "NYSE",
        NASDAQ = "NASDAQ",
        NYSEARCA = "NYSEARCA",
    }

    export const enum TradeDirection {
        buy = "buy",
        sell = "sell",
    }

    export const enum PositionDirection {
        long = "long",
        short = "short",
    }

    export const enum TradeType {
        market = "market",
        limit = "limit",
        stop = "stop",
        stop_limit = "stop_limit",
    }

    export const enum TimeInForce {
        day = "day",
        gtc = "gtc",
        opg = "opg",
        cls = "cls",
        ioc = "ioc",
        fok = "fok",
    }
    export const enum OrderStatus {
        new = "new",
        partial_fill = "partially_filled",
        filled = "filled",
        canceled = "canceled",
        expired = "expired",
        pending_cancel = "pending_cancel",
        pending_replace = "pending_replace",
        done_for_day = "done_for_day",
    }

    export interface AlpacaStreamingOrderUpdate {
        event: OrderUpdateEvent;
        order: AlpacaOrder;
        timestamp: number;
        price: number;
        position_qty: number;
    }

    export const enum OrderUpdateEvent {
        new = "new",
        fill = "fill",
        canceled = "canceled",
        expired = "expired",
        done_for_day = "done_for_day",
        replaced = "replaced",
        partial_fill = "partial_fill",
        pending_cancel = "pending_cancel",
    }

    export interface AlpacaOrder {
        id: string;
        client_order_id?: string;
        created_at: string | Date;
        updated_at: string | Date;
        submitted_at: string | Date;
        filled_at: string | Date;
        expired_at: string | Date;
        canceled_at: string | Date;
        failed_at: string | Date;
        asset_id: string;
        symbol: string;
        asset_class: string;
        qty: number;
        filled_qty: number;
        type: TradeType;
        side: TradeDirection;
        time_in_force: TimeInForce;
        limit_price?: number;
        stop_price?: number;
        filled_avg_price: number;
        status: OrderStatus;
        extended_hours: boolean;
    }
    export interface AlpacaTradeConfig {
        client_order_id?: string;
        symbol: string;
        qty: number;
        side: TradeDirection;
        type: TradeType;
        time_in_force: TimeInForce;
        limit_price?: number;
        stop_price?: number;
        extended_hours?: boolean;
        order_class?: "simple" | "bracket" | "oco" | "oto";
        take_profit?: {
            limit_price: number;
        };
        stop_loss?: {
            stop_price: number;
            limit_price?: number;
        };
    }

    export interface AlpacaPosition {
        asset_id: string;
        symbol: string;
        exchange: string;
        asset_class: string;
        avg_entry_price: string;
        qty: string;
        side: PositionDirection;
        market_value: string;
        cost_basis: string;
        unrealized_pl: string;
        unrealized_plpc: string;
        unrealized_intraday_pl: string;
        unrealized_intraday_plpc: string;
        current_price: string;
        lastday_price: string;
        change_today: string;
    }

    export interface AlpacaAccount {
        account_blocked: boolean;
        account_number: string;
        buying_power: string;
        cash: string;
        created_at: string;
        currency: string;
        daytrade_count: number;
        daytrading_buying_power: string;
        equity: string;
        id: string;
        initial_margin: string;
        last_equity: string;
        last_maintenance_margin: string;
        long_market_value: string;
        maintenance_margin: string;
        multiplier: string;
        pattern_day_trader: boolean;
        portfolio_value: string;
        regt_buying_power: string;
        short_market_value: string;
        shorting_enabled: boolean;
        sma: string;
        status: string;
        trade_suspended_by_user: boolean;
        trading_blocked: boolean;
        transfers_blocked: boolean;
    }

    export type SimpleAlpacaPosition = Pick<
        AlpacaPosition,
        "symbol" | "qty" | "avg_entry_price"
    >;

    export type AlpacaOrderStatusFilter = "open" | "closed" | "all";

    export type SortDirection = "asc" | "desc";

    export interface GetOrdersParams {
        status?: AlpacaOrderStatusFilter;
        after?: Date;
        until?: Date;
        limit?: number;
        direction?: SortDirection;
    }

    export interface Calendar {
        open: string;
        close: string;
        date: string;
    }

    export interface StreamingUpdateSymbol {
        S: string;
    }

    export interface AlpacaBarsV2 {
        /** Timestamp in RFC-3339 format with nanosecond precision. */
        t: string;
        /** Open price. */
        o: number;
        /** High price. */
        h: number;
        /** Low price. */
        l: number;
        /** Close price. */
        c: number;
        /** Volume. */
        v: number;
    }

    export interface AlpacaTradesV2 {
        /** Timestamp in RFC-3339 format with nanosecond precision. */
        t: string;
        /** Exchange where the trade happened. */
        x: string;
        /** Trade price. */
        p: number;
        /** Trade size. */
        s: number;
        /** Trade conditions. */
        c: string[];
        /** Trade ID. */
        i: number;
        /** Tape. */
        z: string;
    }

    export interface AlpacaQuotesV2 {
        /** Timestamp in Date format. */
        t: string;
        /** Ask exchange. */
        ax: string;
        /** Ask price. */
        ap: number;
        /** Ask size. */
        as: number;
        /** Bid exchange. */
        bx: string;
        /** Bid price. */
        bp: number;
        /** Bid size. */
        bs: number;
        /** Quote conditions. */
        c: string[];
    }

    export interface TradesV2Response {
        trades: AlpacaTradesV2[];
        symbol: string;
        next_page_token: string;
    }

    export interface BarsV2Response {
        bars: AlpacaBarsV2[];
        symbol: string;
        next_page_token: string;
    }

    export interface QuotesV2Response {
        quotes: AlpacaQuotesV2[];
        symbol: string;
        next_page_token: string;
    }

    export interface SnapshotResponse {
        latestTrade: AlpacaTradesV2;
        latestQuote: AlpacaQuotesV2;
        minuteBar: AlpacaBarsV2;
        dailyBar: AlpacaBarsV2;
        prevDailyBar: AlpacaBarsV2;
    }

    export interface AlpacaStreamingBar
        extends StreamingUpdateSymbol,
        AlpacaBarsV2 { }

    export interface AlpacaStreamingTrade
        extends StreamingUpdateSymbol,
        AlpacaTradesV2 { }

    export interface AlpacaStreamingQuote
        extends StreamingUpdateSymbol,
        AlpacaQuotesV2 { }

    export class AlpacaStreamV2Client extends EventEmitter {
        connect(): void;
        disconnect(): void;
        onConnect(cb: () => void): void;
        onDisconnect(cb: () => void): void;
        onError(cb: () => void): void;
        onStockTrade(cb: (trade: AlpacaStreamingTrade) => void): void;
        onStockBar(cb: (bar: AlpacaStreamingBar) => void): void;
        onStockQuote(cb: (quote: AlpacaStreamingQuote) => void): void;
        subscribeForTrades(trades: string[]): void;
        unsubscribeFromTrades(trades: string[]): void;
        subscribeForQuotes(quotes: string[]): void;
        unsubscribeFromQuotes(quotes: string[]): void;
        subscribeForBars(bars: string[]): void;
        unsubscribeFromBars(bars: string[]): void;
    }

    export class AlpacaStreamingData extends AlpacaStreamingClient {
        onStockTrades(cb: (subject: string, data: string) => void): void;
        onStockQuotes(cb: (subject: string, data: string) => void): void;
        onStockAggSec(cb: (subject: string, data: string) => void): void;
        onStockAggMin(cb: (subject: string, data: string) => void): void;
    }

    export class AlpacaStreamingUpdates extends AlpacaStreamingClient {
        onOrderUpdate(cb: (subject: AlpacaStreamingOrderUpdate) => void): void;
    }

    export class AlpacaStreamingClient extends EventEmitter {
        connect(): void;
        reconnect(): void;
        disconnect(): void;
        subscribe(params: string[]): void;
        unsubscribe(params: string[]): void;
        onConnect(cb: () => void): void;
        onDisconnect(cb: () => void): void;
        onStateChange(cb: (newState: any) => void): void;
    }

    export interface GetHistoricalOptions {
        start: string;
        end: string;
        limit: number;
        page_token?: string;
        timeframe?: Timeframe;
    }

    export type Timeframe = "1Min" | "1Hour" | "1Day";

    export interface GetHistoricalBarsOptions extends GetHistoricalOptions {
        timeframe: Timeframe;
    }

    export class Alpaca {
        constructor(config: AlpacaParams)
        data_ws: AlpacaStreamingData;
        trade_ws: AlpacaStreamingUpdates;
        data_stream_v2: AlpacaStreamV2Client;
        configuration: any;

        // Account
        getAccount(): Promise<AlpacaAccount>;

        // Positions
        getPositions(): Promise<AlpacaPosition[]>;
        getPosition(symbol: string): Promise<AlpacaPosition>;
        closeAllPositions(cancelOrders: boolean): Promise<{}>;
        closePosition(symbol: string): Promise<{}>;

        // Order
        getOrders(params: GetOrdersParams): Promise<AlpacaOrder[]>;
        getOrderByClientId(oid: string): Promise<AlpacaOrder>;
        createOrder(params: AlpacaTradeConfig): Promise<AlpacaOrder>;
        cancelOrder(oid: string): Promise<{}>;
        cancelAllOrders(): Promise<{}>;


        getAssets(params: GetAssetsParams): Promise<Asset[]>;
        getCalendar({
            start,
            end,
        }: {
            start: Date;
            end: Date;
        }): Promise<Calendar[]>;
        replaceOrder(
            oid: string,
            params: Pick<
                AlpacaTradeConfig,
                | "client_order_id"
                | "limit_price"
                | "stop_price"
                | "time_in_force"
                | "qty"
            >
        ): Promise<AlpacaOrder>;
        getTradesV2(
            symbol: string,
            options: GetHistoricalOptions,
            config: any
        ): Generator<AlpacaTradesV2>;
        getBarsV2(
            symbol: string,
            options: GetHistoricalBarsOptions,
            config: any
        ): Generator<AlpacaBarsV2>;
        getQuotesV2(
            symbol: string,
            options: GetHistoricalOptions,
            config: any
        ): Generator<AlpacaQuotesV2>;
        getSnapshot(symbol: string, config: any): Promise<SnapshotResponse>;
    }

    export default Alpaca;
}