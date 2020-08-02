var express = require('express');
var router = express.Router();
var yahooFinance = require('yahoo-finance');

/* GET users listing. */
router.get('/', async function (req, res, next) {
    yahooFinance.historical({
        symbol: 'AAN',
        from: '1982-01-01',
        to: '2020-8-1',
        period: 'd'  // 'd' (daily), 'w' (weekly), 'm' (monthly), 'v' (dividends only)
    }, function (err, quotes) {
        res.json(quotes);
        if (err) console.log(err);
        else {
            console.log(quotes);
        }
    });
});

module.exports = router;