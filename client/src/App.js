import React, { createRef } from 'react';
import Chart from "./components/Chart";
import Results from "./components/Results";
import Indicators from "./components/Indicators";
import './App.css';

class App extends React.Component {

  constructor(props) {
    super(props);
    this.state = { indicatorOptions: {} }
  }

  render() {
    return (
      <div className="App">
        <div className="App-data">
          <div className="App-chart">
            <Chart />
          </div>
          <div className="App-details">
            Details here
          </div>
        </div>
        <div className="App-query">
          <div className="App-indicators">
            <Indicators />
          </div>
          <div className="App-result">
            <Results />
          </div>
        </div>
      </div>
    );
  }
}

export default App;
