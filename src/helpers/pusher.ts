import Pusher from 'pusher';

import API from '@shared/api';
import { GenericObject } from '@shared/common';

// initialize pusher to communicate to client
var pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.PUSHER_CLUSTER,
    useTLS: true
});

// trigger a pusher channel
function triggerChannel(channel: string, event: API.Pusher.PusherEvents, message: API.Pusher.PusherMessages) {
    pusher.trigger(channel, event, message);
}

export { triggerChannel };