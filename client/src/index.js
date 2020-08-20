import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import ReviewPage from './pages/ReviewPage';
import CreatePage from './pages/CreatePage';
import * as serviceWorker from './serviceWorker';
import { Provider } from 'react-redux'
import { createStore, applyMiddleware } from 'redux'
import reducer from './redux'
import { setPusherClient } from 'react-pusher';
import Pusher from 'pusher-js';
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Link
} from "react-router-dom";
import { composeWithDevTools } from 'redux-devtools-extension';

const store = createStore(reducer, composeWithDevTools());

const pusherClient = new Pusher("27c0991e4a760dce09df", {
  cluster: "us3"
});

setPusherClient(pusherClient);

ReactDOM.render(
  <React.StrictMode>
    <Provider store={store}>
      <Router basename={"/stocks"}>
        <Route exact path="/" component={CreatePage} />
        <Route path="/review" component={ReviewPage} />
      </Router>
    </Provider>
  </React.StrictMode>,
  document.getElementById('root')
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
