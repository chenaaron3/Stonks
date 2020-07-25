import React, { createRef } from 'react';
import Chart from "./components/Chart";
import Results from "./components/Results";
import Indicators from "./components/Indicators";
import './App.css';

class App extends React.Component {

  constructor(props) {
    super(props);
    this.state = { symbol: undefined, results: undefined, indicatorOptions: {} }
  }

  // called from results component to view a specific stock
  viewStock = (symbol, results) => {
    this.setState({ symbol: symbol, results: results });
  }

  // called from indicators component to set indicator options
  setIndicatorOptions = (indicatorOptions) => {
    console.log("Setting Options to", indicatorOptions);
    this.setState({ indicatorOptions: indicatorOptions });
  }

  render() {
    return (
      <div className="App">
        <div className="App-data">
          <div className="App-chart">
            {
              this.state.symbol && <Chart symbol={this.state.symbol} results={this.state.results} />
            }
            {
              !this.state.symbol && <div className="App-missing-chart">
                <span>Run a strategy!</span>
              </div>
            }
          </div>
          <div className="App-details">
            Details here
          </div>
        </div>
        <div className="App-query">
          <div className="App-indicators">
            <Indicators setIndicatorOptions={this.setIndicatorOptions} />
          </div>
          <div className="App-result">
            <Results viewStock={this.viewStock} indicatorOptions={this.state.indicatorOptions} />
          </div>
        </div>
      </div>
    );
  }
}

export default App;
