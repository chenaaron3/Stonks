var express = require('express');
var router = express.Router();
var childProcess = require('child_process');
var githubUsername = 'chenaaron3'
var scriptDirectory = '~'
var scriptFile = 'stonksDeploy.sh'

router.post("/github", function (req, res) {
    var sender = req.body.sender;
    var branch = req.body.ref;

    if (branch.indexOf('stonksv2') > -1 && sender.login === githubUsername) {
        res.sendStatus(200);
        console.log(`Push Detected from ${sender.login}! Now Deploying!`);
        deploy();
    }
    else {
        res.sendStatus(403);
        console.log(`Only ${githubUsername} can auto-deploy. You are ${sender.login}.`)
    }
})

function deploy() {
    let command = `cd ${scriptDirectory} && ./${scriptFile}`;
    let child = childProcess.spawn(command, {
        stdio: 'inherit',
        shell: true
    });

    child.on('exit', function (code, signal) {
        console.log('child process exited with ' + `code ${code} and signal ${signal}`);
    });
}

module.exports = router;