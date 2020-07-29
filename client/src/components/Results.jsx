import React, { createRef } from 'react';
import { connect } from 'react-redux';
import { viewStock } from '../redux';
import './Results.css';
import { NeuButton } from 'neumorphism-react';
import eye from "../eye.svg";

class Results extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            sortedSymbols: []
        };
        this.results = {};
    }

    componentDidUpdate(prevProps) {
        if (this.props.results !== prevProps.results) {
            let sortedSymbols = Object.keys(this.props.results)
            sortedSymbols.sort((a, b) => {
                return this.props.results[b]["percentProfit"] - this.props.results[a]["percentProfit"];
            });
            this.setState({ sortedSymbols })
        }
    }

    render() {
        return (
            <div className="results">
                <span className="results-title">Top Results</span>
                <div className="results-list">
                    {this.state.sortedSymbols.length == 0 && (<span>
                        There are no results...
                    </span>)
                    }
                    {this.state.sortedSymbols.length != 0 && (
                        this.state.sortedSymbols.map((symbol, index) => {
                            return <div className="result" key={index}>
                                <img className="result-icon" width="25px" height="25px" src={eye} alt="Eye" onClick={() => { this.props.viewStock(symbol, this.props.results[symbol]) }} />
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

let mapStateToProps = (state) => {
    console.log("New REsults", state);
    return { results: state.results };
};

export default connect(mapStateToProps, { viewStock })(Results);
