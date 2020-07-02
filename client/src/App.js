import React from 'react';
import Hit from './components/Hit';
import './App.css';

class App extends React.Component {

  constructor(props) {
    super(props);
    this.state = { results: {}, status: "" }
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
    keys.sort();
    return (
      <div className="App">
        <header className="App-header">
          <h1>
            Golden Cross Screener
          </h1>
          <button className="App-update" type="button" onClick={this.updateResults}>Update</button>
          <h3>{this.state.status}</h3>
          <div className="App-results">
            {
              keys.map((value, index) => {
                return <Hit date={this.state.results[value]} key={index} value={value}></Hit>
              })
            }
          </div>
        </header>
      </div>
    );
  }
}

export default App;
