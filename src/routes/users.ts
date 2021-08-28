import express, { Request, Response } from 'express';
import { addToStocksTrackerWatchlist } from '../helpers/stockstracker';
import { addToFinvizWatchlist } from '../helpers/finviz';
import { addJob } from '../helpers/queue';
import { setDocumentField, addDocument, getDocument } from '../helpers/mongo';
import passport from 'passport';
import Account from '../models/account';

import { MongoUser } from '../types/types';

import API from '@shared/api';

let router = express.Router();

let watchlistFunctions = {
    "StocksTracker": addToStocksTrackerWatchlist,
    "Finviz": addToFinvizWatchlist
}

let userSchema = {
    buys: {},
    backtestIDs: [],
    alpaca: {
        id: "",
        key: ""
    },
    tradeSettings: {
    }
}

// add to watchlist
router.post('/watchlist', async function (
    req: Request<{}, {}, API.Users.PostWatchlist>,
    res: Response<API.Users._PostWatchlist>) {
    let destination = req.body.destination;
    let symbols = req.body.symbols;
    let login = req.body.login;
    let watchlist = req.body.watchlist;
    let position = addJob(() => {
        return new Promise(async resolveJob => {
            await watchlistFunctions[destination](symbols, login, watchlist);
            resolveJob();
        })
    }, true)
    if (position == 0) {
        res.json({ status: "Adding to your watchlist!" });
    }
    else {
        res.json({ status: `Will add to your watchlist within ${30 * position} minutes!` });
    }
})

// check logged in user
router.get('/', (
    req: Request<{}, {}, API.Users.Get>,
    res: Response<API.Users._Get>) => {
    if (req.user) {
        res.json(req.user);
    }
    else {
        res.json({ error: "You are not logged in!" });
    }
})

// check login status
router.get('/isLoggedIn', (
    req: Request<{}, {}, API.Users.GetIsLoggedIn>,
    res: Response<API.Users._GetIsLoggedIn>) => {
    if (req.user) {
        res.json({ isLoggedIn: true });
    }
    else {
        res.json({ isLoggedIn: false });
    }
})

// login
router.post('/login', (
    req: Request<{}, {}, API.Users.PostLogin>,
    res: Response<API.Users._PostLogin>,
    next) => {
    passport.authenticate('local',
        (err, user, info) => {
            if (err) {
                return res.json({ error: err })
            }

            // username does not exist
            if (!user) {
                return res.json({ error: info });
            }

            req.logIn(user, function (err) {
                // wrong password
                if (err) {
                    return res.json({ error: err['message'] })
                }

                return res.json({ status: "Successfully Logged In" });
            });

        })(req, res, next);
});

// register new user
router.post('/register', async (
    req: Request<{}, {}, API.Users.PostRegister>,
    res: Response<API.Users._PostRegister>) => {
    try {
        await Account.register({ username: req.body.username } as any, req.body.password);
        // add base doc to user db
        await addDocument<MongoUser>("users", { ...userSchema, _id: req.body.username })
        res.json({ status: "Successfully Registered" });
    }
    catch (err) {
        res.json({ error: err })
    }
})

// logout
router.get('/logout', async (
    req: Request<{}, {}, API.Users.GetLogout>,
    res: Response<API.Users._GetLogout>) => {
    req.logout();
    res.json({ status: "Successfully Logged Out" })
})

// add user data
router.post("/data", (
    req: Request<{}, {}, API.Users.PostData>,
    res: Response<API.Users._PostData>) => {
    if (req.user) {
        setDocumentField("users", req.user.username, req.body.field, req.body.value, undefined);
        res.json({ status: "ok" })
    }
    else {
        res.json({ error: 'User does not exist' });
    }
})

// get user data
router.get("/data", async (
    req: Request<{}, {}, API.Users.GetData>,
    res: Response<API.Users._GetData>) => {
    if (req.user) {
        res.json(await getDocument<MongoUser>("users", req.user.username));
    }
    else {
        res.json({ error: 'User does not exist' });
    }
})

export =router;