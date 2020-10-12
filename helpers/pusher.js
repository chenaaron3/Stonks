var Pusher = require('pusher');

// initialize pusher to communicate to client
var pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.PUSHER_CLUSTER,
    useTLS: true
});

// trigger a pusher channel
function triggerChannel(channel, event, message) {
    pusher.trigger(channel, event, message);
}

module.exports = { triggerChannel };