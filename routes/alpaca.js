var express = require('express');
var router = express.Router();
let { getAccount, requestBracketOrder, changeAccount } = require('../helpers/alpaca');

router.get("/", (req, res) => {
    changeAccount({ id: process.env.APCA_API_KEY_ID, key: process.env.APCA_API_SECRET_KEY });
    getAccount().then(account => {
        res.json(account);
    })
})

router.post("/order", function (req, res) {
    let symbol = req.body.symbol;
    let buyPrice = req.body.buyPrice;
    let positionSize = req.body.positionSize;
    let stoploss = req.body.stoploss;
    let target = req.body.target;

    requestBracketOrder(symbol, buyPrice, positionSize, stoploss, target)
        .then(order => res.json(order))
        .catch(err => res.json(err));
})

module.exports = router;