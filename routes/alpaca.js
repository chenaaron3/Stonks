var express = require('express');
var router = express.Router();
let { getAccount, requestBracketOrder } = require('../helpers/alpaca');

router.get("/", (req, res) => {
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