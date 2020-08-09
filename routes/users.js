var express = require('express');
var router = express.Router();
var yahooFinance = require('yahoo-finance');
var fetch = require('node-fetch');

/* GET users listing. */
router.get('/', async function (req, res, next) {
    let symbol = req.query.symbol;
    yahooFinance.historical({
        symbol: symbol,
        from: '1982-01-01',
        to: new Date(),
        period: 'd'  // 'd' (daily), 'w' (weekly), 'm' (monthly), 'v' (dividends only)
    }, function (err, quotes) {
        res.json(quotes);
        if (err) console.log(err);
    });
});

router.get('/pop', async function (req, res) {
    
})

module.exports = router;