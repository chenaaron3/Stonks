declare module 'yahoo-finance' {
    export interface historicalOptions {
        symbol: string;
        from: Date;
        to: Date;
        period: 'd' | 'w' | 'm' | 'v';
    }

    export interface YahooBars {
        date: string;
        adjClose: number;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
    }

    function historical(options: historicalOptions): Promise<YahooBars[]>;

    export { historical };
}