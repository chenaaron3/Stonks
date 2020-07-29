import React, { createRef } from 'react';
import { connect } from 'react-redux';
import { viewStock } from '../redux';
import './Results.css';
import { NeuButton } from 'neumorphism-react';
import Pusher from 'react-pusher';
import { setPusherClient } from 'react-pusher';
import eye from "../eye.svg";

class Results extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            sortedSymbols: []
        };
        this.results = {};
    }

    onResultFinished = (results) => {
       let sortedSymbols = Object.keys(results)
        sortedSymbols.sort((a, b) => {
            return results[b]["percentProfit"] - results[a]["percentProfit"];
        });
        this.setState({ sortedSymbols })
    }

    componentDidUpdate(prevProps) {
        if (this.props.id !== prevProps.id) {
            console.log("Got the new id.", this.props.id);
        }
    }

    render() {
        console.log("LISTENING TO", this.props.id);
        return (
            <div className="results">
            <Pusher
              channel={this.props.id}
              event="onResultsFinished"
              onUpdate={(data) => console.log("got the event", data)}
            />
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
    console.log(`New State ${state} Detected in Results!`);
    return { id: state.id };
};

export default connect(mapStateToProps, { viewStock })(Results);
