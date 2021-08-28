import express, { Request, Response } from 'express';
import { getAccount, getClosedOrders, getPositions, requestBracketOrder, changeAccount, getOpenOrders } from '../helpers/alpaca';
import { getDocument } from '../helpers/mongo';

import { MongoUser } from '../types/types';
import API from '@shared/api';

var router = express.Router();

router.get("/", (
    req: Request<{}, {}, {}, API.Alpaca.Get>,
    res: Response<API.Alpaca._Get>) => {
    changeAccount({ id: process.env.APCA_API_KEY_ID, key: process.env.APCA_API_SECRET_KEY });
    getAccount().then(account => {
        res.json(account);
    })
})

router.get("/closedOrders", async (
    req: Request<{}, {}, {}, API.Alpaca.GetClosedOrders>,
    res: Response<API.Alpaca._GetClosedOrders>) => {
    // user is logged in
    if (req.user) {
        let userDoc = await getDocument<MongoUser>("users", req.user["username"]);
        let alpacaCredentials = userDoc!["alpaca"];

        // user uses alpaca
        let useAlpaca = alpacaCredentials["id"].length > 0 && alpacaCredentials["key"].length > 0;

        if (useAlpaca) {
            changeAccount({ id: alpacaCredentials["id"], key: alpacaCredentials["key"] });
            getClosedOrders().then(orders => {
                res.json(orders)
            })
            return;
        }
    }

    res.json([]);
})

router.get("/openOrders", async (
    req: Request<{}, {}, {}, API.Alpaca.GetOpenOrders>,
    res: Response<API.Alpaca._GetOpenOrders>) => {
    // user is logged in
    if (req.user) {
        let userDoc = await getDocument<MongoUser>("users", req.user["username"]);
        let alpacaCredentials = userDoc!["alpaca"];

        // user uses alpaca
        let useAlpaca = alpacaCredentials["id"].length > 0 && alpacaCredentials["key"].length > 0;

        if (useAlpaca) {
            changeAccount({ id: alpacaCredentials["id"], key: alpacaCredentials["key"] });
            getOpenOrders().then(orders => {
                res.json(orders)
            })
            return;
        }
    }

    res.json([]);
})

router.get("/positions", async (
    req: Request<{}, {}, {}, API.Alpaca.GetPositions>,
    res: Response<API.Alpaca._GetPositions>) => {
    // user is logged in
    if (req.user) {
        let userDoc = await getDocument<MongoUser>("users", req.user["username"]);
        let alpacaCredentials = userDoc!["alpaca"];

        // user uses alpaca
        let useAlpaca = alpacaCredentials["id"].length > 0 && alpacaCredentials["key"].length > 0;

        if (useAlpaca) {
            changeAccount({ id: alpacaCredentials["id"], key: alpacaCredentials["key"] });
            getPositions().then(positions => {
                res.json(positions)
            })
            return;
        }
    }

    res.json([]);
})

router.post("/order", function (
    req: Request<{}, {}, API.Alpaca.PostOrder>,
    res: Response<API.Alpaca._PostOrder>) {
    let symbol = req.body.symbol;
    let buyPrice = req.body.buyPrice;
    let positionSize = req.body.positionSize;
    let stoploss = req.body.stoploss;
    let target = req.body.target;

    requestBracketOrder(symbol, buyPrice, positionSize, stoploss, target)
        .then(order => res.json(order))
        .catch(err => res.json(err));
})

export = router;