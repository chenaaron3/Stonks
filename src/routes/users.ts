import express, { Request } from 'express';
import { addToStocksTrackerWatchlist } from '../helpers/stockstracker';
import { addToFinvizWatchlist } from '../helpers/finviz';
import { addJob } from '../helpers/queue';
import { setDocumentField, addDocument, getDocument } from '../helpers/mongo';
import passport from 'passport';
import Account from '../models/account';

import { ExportLogin } from '../types/types';

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
interface WatchlistBody {
    destination: 'StocksTracker' | 'Finviz';
    symbols: string[];
    login: ExportLogin;
    watchlist: string;
}

router.post('/watchlist', async function (req: Request<{}, {}, WatchlistBody>, res) {
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
router.get('/', (req, res) => {
    if (req.user) {
        res.json(req.user);
    }
    else {
        res.json({ error: "You are not logged in!" });
    }
})

// check login status
router.get('/isLoggedIn', (req, res) => {
    if (req.user) {
        res.json({ isLoggedIn: true });
    }
    else {
        res.json({ isLoggedIn: false });
    }
})

// login
router.post('/login', (req, res, next) => {
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
                    return res.json({ error: err })
                }

                return res.json({ status: "Successfully Logged In", user: req.user });
            });

        })(req, res, next);
});

// register new user
router.post('/register', async (req: Request<{}, {}, { username: string; password: string }>, res) => {
    try {
        await Account.register({ username: req.body.username } as any, req.body.password);
        // add base doc to user db
        await addDocument("users", { ...userSchema, _id: req.body.username })
        res.json({ status: "Successfully Registered" });
    }
    catch (err) {
        res.json({ error: err })
    }
})

// logout
router.get('/logout', async (req, res) => {
    req.logout();
    res.json({ status: "Successfully Logged Out" })
})

router.post("/data", (req: Request<{}, {}, { field: string; value: any }>, res) => {
    if (req.user) {
        setDocumentField("users", req.user.username, req.body.field, req.body.value, undefined);
    }
    res.json({ stats: "ok" })
})

router.get("/data", async (req, res) => {
    if (req.user) {
        res.json(await getDocument("users", req.user.username));
    }
    else {
        res.json({ stats: "ok" })
    }
})

export =router;