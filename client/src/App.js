import React, { createRef } from 'react';
import Hit from './components/Hit';
import './App.css';

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = { results: {}, status: "", comparator: undefined }
    this.selectRef = createRef();
  }

  componentDidMount() {
    fetch("/results")
      .then(res => res.json())
      .then(json => {
        this.setState({ results: json });
      });
    fetch("/metadata")
      .then(res => res.json())
      .then(json => {
        const d = new Date(json["lastUpdate"]);
        const ye = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(d);
        const mo = new Intl.DateTimeFormat('en', { month: 'short' }).format(d);
        const da = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(d);
        this.setState({ status: `Last Updated: ${mo} ${da} ${ye}` })
      })
  }

  onSortChange = (e) => {
    let val = e.target.value;
    if (val == "alphabetical") {
      this.setState({ comparator: undefined});
    }
    else if (val == "date") {
      this.setState({ comparator: (a, b) => new Date(this.state.results[a][0]["date"]) - new Date(this.state.results[b][0]["date"])});
    }
    else if (val == "volume") {
      this.setState({ comparator: (a, b) => this.state.results[a][0]["volume"] - this.state.results[b][0]["volume"] });
    }
    else if (val == "macd") {
      this.setState({ comparator: (a, b) => this.state.results[a][0]["macd"] - this.state.results[b][0]["macd"] });
    }
  }

  updateResults = () => {
    this.setState({ status: "..." })
    fetch("/intersections")
      .then(res => res.json())
      .then(json => {
        this.setState({ status: json["status"] })
      })
  }

  render() {
    let keys = Object.keys(this.state.results);
    keys.sort(this.state.comparator);
    return (
      <div className="App">
        <header className="App-header">
          <h1>
            Golden Cross Screener
          </h1>
          <button className="App-update" type="button" onClick={this.updateResults}>Update</button>
          <h3>{this.state.status}</h3>
          <div>
            <label>Sort By: </label>
            <select className="App-sort" onChange={this.onSortChange}>
              <option value="alphabetical">Alphabetical</option>
              <option value="date">Date</option>
              <option value="volume">Volume</option>
              <option value="macd">MACD</option>
            </select>
          </div>
          <div className="App-results">
            {
              keys.map((symbol, index) => {
                return <Hit value={this.state.results[symbol][0]} key={symbol} symbol={symbol}></Hit>
              })
            }
          </div>
        </header>
      </div>
    );
  }
}

export default App;
