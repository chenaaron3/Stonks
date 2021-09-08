import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import CreatePage from './pages/CreatePage';
import SummaryPage from './pages/SummaryPage';
import ReviewPage from './pages/ReviewPage';
import SimulatePage from './pages/SimulatePage';
import OptimizePage from './pages/OptimizePage';
// import WatchlistPage from './pages/WatchlistPage';
// import AccountPage from './pages/AccountPage';

// import * as serviceWorker from './serviceWorker';

import { Provider } from 'react-redux'
import { store } from './redux/store';
import { setPusherClient } from 'react-pusher';
import Pusher from 'pusher-js';
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Link
} from "react-router-dom";
import { ThemeProvider, createMuiTheme } from '@material-ui/core/styles';
import green from '@material-ui/core/colors/green';
import red from '@material-ui/core/colors/red';

// Pusher
const pusherClient = new Pusher("27c0991e4a760dce09df", {
  cluster: "us3"
});
setPusherClient(pusherClient);

// Material UI
const theme = createMuiTheme({

});

ReactDOM.render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <Router basename={"/stocks"}>
          <div className='app-root'>
            <Switch>

              <Route exact path="/" component={CreatePage} />
              <Route path="/summary" component={SummaryPage} />
              <Route path="/review" component={ReviewPage} />
              <Route path="/simulate" component={SimulatePage} />
              <Route path="/optimize" component={OptimizePage} />
              {/* 
              <Route path="/watchlist" component={WatchlistPage} />
              <Route path="/account" component={AccountPage} /> 
            */}
              <Route path="/:backtestID" render={(props) => <CreatePage />} />
            </Switch>
          </div>
        </Router>
      </ThemeProvider>
    </Provider>
  </React.StrictMode>,
  document.getElementById('root')
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
// serviceWorker.unregister();
