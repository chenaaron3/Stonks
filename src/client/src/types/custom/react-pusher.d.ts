declare module "react-pusher" {
    import React from 'react';
    import Pusher from 'pusher-js';
    import API from '../api';

    export function setPusherClient(Pusher): void;

    export interface ReactPusherProps {
        channel: string;
        event: API.Pusher.PusherEvents;
        onUpdate: (message: any) => void;
    }

    declare const MyComponent: React.FC<ReactPusherProps>
    export default MyComponent
}