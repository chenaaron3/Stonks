import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import * as serviceWorker from './serviceWorker';
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import reducer from './redux'
import { setPusherClient } from 'react-pusher';
import Pusher from 'pusher-js';

const store = createStore(reducer);
 
const pusherClient = new Pusher("27c0991e4a760dce09df", {
  cluster: "us3"
});
 
setPusherClient(pusherClient);

ReactDOM.render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>,
  document.getElementById('root')
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
