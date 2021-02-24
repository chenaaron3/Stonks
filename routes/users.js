var express = require('express');
var router = express.Router();
let { addToStocksTrackerWatchlist } = require('../helpers/stockstracker');
let { addToFinvizWatchlist } = require('../helpers/finviz');
let { addJob } = require('../helpers/queue');
let { setDocumentField, addDocument, getDocument } = require('../helpers/mongo');
const passport = require('passport');
const Account = require('../models/account');

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
    }
}

// add to watchlist
router.post('/watchlist', async function (req, res) {
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
router.post('/register', async (req, res) => {
    try {
        await Account.register({ username: req.body.username }, req.body.password);
        // add base doc to user db
        addDocument("users", { ...userSchema, _id: req.body.username })
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

router.post("/data", (req, res) => {
    if (req.user) {
        setDocumentField("users", req.user.username, [req.body.field], req.body.value, {});
    }
    res.json({stats: "ok"})
})

router.get("/data", async (req, res) => {
    if (req.user) {
        res.json(await getDocument("users", req.user.username));
    }
    else {
        res.json({stats: "ok"})
    }
})

module.exports = router;