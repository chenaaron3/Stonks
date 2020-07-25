import React, { createRef } from 'react';
import './Results.css';
import { NeuButton } from 'neumorphism-react';
import eye from "../eye.svg";

class Results extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            symbols: ["AAPL", "TSLA", "GOOGL"]
        }
    }

    componentDidMount() {
        // fetch results here
    }

    render() {
        return (
            <div className="results">
                <NeuButton className="results-start-button" width="7vw" height="6vh" color="#E0E5EC" distance={3}>
                    <span className="results-start-text">Start!</span>
                </NeuButton>
                <span className="results-title">Results</span>
                <div className="results-list">
                    {this.state.symbols.length == 0 && (<span>
                        There are no results...
                    </span>)
                    }
                    {this.state.symbols.length != 0 && (
                        this.state.symbols.map(symbol => {
                            return <Result symbol={symbol} />
                        })
                    )
                    }
                </div>
            </div>
        );
    }
}

class Result extends React.Component {
    render() {
        return (<div className="result">
            <img className="result-icon" width="25px" height="25px" src={eye} alt="Eye" />
            <span className="result-text">{this.props.symbol}</span>
        </div>);
    }
}

export default Results;
