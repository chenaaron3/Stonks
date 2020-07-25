import React, { createRef } from 'react';
import './Results.css';
import { NeuButton } from 'neumorphism-react';
import eye from "../eye.svg";

class Results extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            sortedSymbols: [],
            results: {},
        }
    }

    getResults = () => {
        // fetch results here
        fetch("/results")
            .then(res => res.json())
            .then(results => {
                let sortedSymbols = Object.keys(results).sort((a, b) => {
                    return results[b]["percentProfit"] - results[a]["percentProfit"];
                });
                this.setState({ results: results, sortedSymbols: sortedSymbols });
            })
    }

    render() {
        return (
            <div className="results">
                <NeuButton className="results-start-button" width="7vw" height="6vh" color="#E0E5EC" distance={3} onClick={this.getResults}>
                    <span className="results-start-text">Get Results!</span>
                </NeuButton>
                <span className="results-title">Top Results</span>
                <div className="results-list">
                    {this.state.sortedSymbols.length == 0 && (<span>
                        There are no results...
                    </span>)
                    }
                    {this.state.sortedSymbols.length != 0 && (
                        this.state.sortedSymbols.map((symbol, index) => {
                            return <div className="result" key={index}>
                                <img className="result-icon" width="25px" height="25px" src={eye} alt="Eye" onClick={() => { this.props.viewStock(symbol, this.state.results[symbol]) }} />
                                <span className="result-text">{`${index + 1}. ${symbol}`}</span>
                            </div>;
                        })
                    )
                    }
                </div>
            </div>
        );
    }
}

// class Result extends React.Component {
//     render() {
//         return (<div className="result">
//             <img className="result-icon" width="25px" height="25px" src={eye} alt="Eye" onClick={this.props.viewStock(this.props.symbol, this.props.results)} />
//             <span className="result-text">{`${this.props.index + 1}. ${this.props.symbol}`}</span>
//         </div>);
//     }
// }

export default Results;
