var fs = require('fs');
let { conductBacktest } = require('../helpers/backtest');

process.on('message', (msg) => {
    if (msg.type == "start"){
        conductBacktest(msg.strategyOptions, msg.id)
        .then(() => {
            process.send({status: "finished"});
            fs.writeFileSync(__dirname + `\\${msg.id}.txt`, `id ${msg.id} finished`, { encoding: "utf-8" })
        });
    }
});