import express, { Request, Response } from 'express';

import { getDocument, getDocumentField, setDocumentField } from '../helpers/mongo';
import { getAdjustedData, getSwingPivots } from '../helpers/utils';
import { getIndicator } from '../helpers/backtest';
import { getLatestPrice } from '../helpers/stock';

import { COLLECTION_NAMES, MongoPrices, MongoUser } from '../types/types';
import { BoughtSymbolData, Timeframe } from '@shared/common';
import Indicator from '@shared/indicator';

import API from '@shared/api';

const router = express.Router();

//#region Watchlist
// gets the most updated price for a stock
router.get("/latestPrice", async (
    req: Request<{}, {}, {}, API.Symbol.GetLatestPrice>,
    res: Response<API.Symbol._GetLatestPrice>) => {
    let symbol = req.query.symbol;
    let entry = await getLatestPrice(symbol);
    res.json(entry);
})

// gets a user's bought symbol list
router.get("/boughtSymbols", async (
    req: Request<{}, {}, {}, API.Symbol.GetBoughtSymbols>,
    res: Response<API.Symbol._GetBoughtSymbols>) => {
    // if not logged in
    if (!req.user) {
        if (!req.session.hasOwnProperty("buys")) {
            req.session["buys"] = {};
        }
        res.json(req.session["buys"]);
    }
    // if logged in
    else {
        let user = await getDocument<MongoUser>("users", req.user.username);
        res.json(user!["buys"]);
    }
})

// buy
router.get("/buySymbol", async (
    req: Request<{}, {}, {}, API.Symbol.GetBuySymbol>,
    res: Response<API.Symbol._GetBuySymbol>) => {
    let symbol = req.query.symbol;
    let entry = await getLatestPrice(symbol);
    let date = entry["date"];
    let price = entry["close"]

    let buyDict: BoughtSymbolData = {};
    if (!req.user) {
        // if first buy
        if (!req.session.hasOwnProperty("buys")) {
            req.session["buys"] = {};
        }
        buyDict = req.session["buys"]!;
    }
    else {
        let user = await getDocumentField<MongoUser>("users", req.user.username, ["buys"]);
        buyDict = user!["buys"];
    }

    // if first buy for symbol
    if (!buyDict.hasOwnProperty(symbol)) {
        buyDict[symbol] = [];
    }

    // add date
    if (!buyDict[symbol].some(e => e.date == date)) {
        buyDict[symbol].push({ date, price });
    }

    // store back into db
    if (req.user) {
        await setDocumentField("users", req.user.username, "buys", buyDict, undefined);
    }

    res.json(buyDict);
});

// sell
router.get("/sellSymbol", async (
    req: Request<{}, {}, {}, API.Symbol.GetSellSymbol>,
    res: Response<API.Symbol._GetSellSymbol>) => {
    let symbol = req.query.symbol;

    if (!req.user) {
        // check buys
        if (!req.session.hasOwnProperty("buys")) {
            res.json({});
            return;
        }
    }

    let buyDict: BoughtSymbolData = {};
    if (!req.user) {
        buyDict = req.session["buys"]!;
    }
    else {
        let user = await getDocumentField<MongoUser>("users", req.user.username, ["buys"]);
        buyDict = user!["buys"];
    }

    // check symbol buy
    if (!buyDict.hasOwnProperty(symbol)) {
        res.json(buyDict);
    }
    else {
        delete buyDict[symbol];
        if (req.user) {
            await setDocumentField("users", req.user.username, "buys", buyDict, undefined);
        }
        res.json(buyDict);
    }
})
//#endregion

//#region Graphs
// get graph for an indicator
router.post("/indicatorGraph", async (
    req: Request<{}, {}, API.Symbol.PostIndicatorGraph>,
    res: Response<API.Symbol._PostIndicatorGraph>) => {
    let symbol = req.body["symbol"];
    let indicatorName = req.body["indicatorName"];
    let indicatorOptions = req.body["indicatorOptions"];
    let timeframe = req.body["timeframe"] ? req.body["timeframe"] : "1Day";

    let stockInfo = await getDocument<MongoPrices>(("prices" + timeframe) as COLLECTION_NAMES, symbol);
    if (stockInfo && stockInfo.length != 0) {
        let pricesJSON = stockInfo["prices"];
        let { prices, volumes, opens, highs, lows, closes, dates } = getAdjustedData(pricesJSON, undefined, undefined);

        let indicator = getIndicator(indicatorName, indicatorOptions, symbol, dates, prices, opens, highs, lows, closes);

        res.json(indicator.getGraph());
    }
})

// get price data for a symbol
router.post("/priceGraph", async (
    req: Request<{}, {}, API.Symbol.PostPriceGraph>,
    res: Response<API.Symbol._PostPriceGraph>) => {
    let symbol = req.body["symbol"];
    let indicators = req.body["indicators"];
    let timeframe = req.body["timeframe"] ? req.body["timeframe"] : "1Day";

    // get prices from database
    let stockInfo = await getDocument<MongoPrices>(("prices" + timeframe) as COLLECTION_NAMES, symbol);
    if (stockInfo && stockInfo.length != 0) {
        let pricesJSON = stockInfo["prices"];
        let { prices, volumes, opens, highs, lows, closes, dates } = getAdjustedData(pricesJSON, undefined, undefined);
        let atr = getIndicator("ATR", { period: 12 }, symbol, dates, prices, opens, highs, lows, closes).getGraph();
        let pivots = getSwingPivots(dates, prices, 12);

        let indicatorGraphs: { [key: string]: Indicator.GraphData } = {};
        (Object.keys(indicators) as Indicator.IndicatorNames[]).forEach((indicatorName) => {
            let indicator = getIndicator(indicatorName, indicators[indicatorName], symbol, dates, prices, opens, highs, lows, closes);
            indicatorGraphs[indicatorName] = indicator.getGraph();
        })

        res.json({ price: pricesJSON, indicators: indicatorGraphs, atr, pivots, volumes });
    }
    else {
        res.json({ price: [], indicators: {}, atr: {}, pivots: {}, volumes: {} });
    }
});
//#endregion

export =router;