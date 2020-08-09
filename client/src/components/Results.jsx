import React, { createRef } from 'react';
import { connect } from 'react-redux';
import { viewStock } from '../redux';
import './Results.css';
import Pusher from 'react-pusher';
import edit from "../edit.svg";
import check from "../check.svg";
import cross from "../cross.svg";
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import Result from "./Result";

class Results extends React.Component {
    constructor(props) {
        super(props);
        // create saved results if it doesnt exist
        if (!localStorage.getItem("savedResults")) {
            localStorage.setItem("savedResults", "[]")
        }
        this.state = {
            sortedSymbols: [],
            results: {},
            savedResults: JSON.parse(localStorage.getItem("savedResults"))
        };
    }

    // when server signals that the results are ready
    onResultFinished = async (data) => {
        let id = data["id"];

        let results = await this.fetchResults(id);
        let displayName = Object.keys(results["strategyOptions"]["indicators"]).join("/");

        // add id to saved results, map id to display name
        this.setState({ savedResults: [...this.state.savedResults, { id, display: displayName }] }, 
            () => {
            // store back into local storage
            localStorage.setItem("savedResults", JSON.stringify(this.state.savedResults));
        });
    }

    // change display name for saved results
    editSavedResults = (id, newDisplay) => {
        let newSave = [];
        this.state.savedResults.forEach(save => {
            if (save["id"] == id) {
                newSave.push({ id, display: newDisplay });
            }
            else {
                newSave.push(save);
            }
        })
        this.setState({ savedResults: newSave }, () => {
            // store back into local storage
            localStorage.setItem("savedResults", JSON.stringify(this.state.savedResults));
        });
    }

    // remove a saved result
    removeSavedResults = (id) => {
        let newSave = [];
        this.state.savedResults.forEach(save => {
            if (save["id"] != id) {
                newSave.push(save);
            }
        })
        this.setState({ savedResults: newSave }, () => {
            // store back into local storage
            localStorage.setItem("savedResults", JSON.stringify(this.state.savedResults));
        });
    }

    // display results from the server
    fetchResults = (id) => {
        return new Promise(resolve => {
            // get the data from the server
            fetch(`/results?id=${id}`, {
                method: 'GET'
            }).then(res => res.json())
                .then(results => {
                    // sort the results
                    let sortedSymbols = Object.keys(results["symbolData"]);
                    sortedSymbols.sort((a, b) => {
                        return results["symbolData"][b]["percentProfit"] - results["symbolData"][a]["percentProfit"];
                    });                    
                    // update the display
                    this.setState({ sortedSymbols, results });
                    resolve(results);
                });
        })
    }

    // when starting backtest with new id
    componentDidUpdate(prevProps) {
        if (this.props.id !== prevProps.id) {
            console.log("Got the new id.", this.props.id);
        }
    }

    // when clicking on an item
    handleGetResult = (symbol) => {
        this.props.viewStock(symbol, this.state.results["symbolData"][symbol])
    }

    render() {
        return (
            <div className="results">
                <Pusher
                    channel={this.props.id}
                    event="onResultsFinished"
                    onUpdate={this.onResultFinished}
                />
                <span className="results-title">Results</span>
                <Tabs>
                    <TabList>
                        <Tab>Past</Tab>
                        <Tab>Active</Tab>
                    </TabList>
                    <TabPanel>
                        <div className="results-list">
                            {this.state.savedResults.length == 0 && (<span>
                                There are no past results...
                            </span>)
                            }
                            {this.state.savedResults.length != 0 && (
                                this.state.savedResults.map((save, index) => {
                                    return <SavedResult id={save["id"]} display={save["display"]} fetchResults={this.fetchResults}
                                        editSavedResults={this.editSavedResults} removeSavedResults={this.removeSavedResults} />
                                })
                            )
                            }
                        </div>
                    </TabPanel>
                    <TabPanel>
                        {
                            this.state.sortedSymbols.length > 0 && <Result sortedSymbols={this.state.sortedSymbols} results={this.state.results} handleGetResult={this.handleGetResult}></Result>
                        }
                    </TabPanel>
                </Tabs>
            </div>
        );
    }
}

class SavedResult extends React.Component {
    state = { editting: false, display: this.props.display, hovered: false }

    onRemove = () => {
        this.props.removeSavedResults(this.props.id);
    }

    onEditStart = () => {
        this.setState({ editting: true });
    }

    onEditFinish = () => {
        this.props.editSavedResults(this.props.id, this.state.display);
        this.setState({ editting: false });
    }

    render() {
        return <div className="result" onMouseEnter={() => this.setState({ hovered: true })} onMouseLeave={() => this.setState({ hovered: false })}>
            {this.state.editting && (
                <>
                    <img className="result-icon result-hover" width="20px" height="20px" src={check} alt="Check" onClick={this.onEditFinish} />
                    <input className="result-edit" type="text" value={this.state.display} onChange={(e) => { this.setState({ display: e.target.value }); }}></input>
                </>
            )}
            {!this.state.editting && (
                <>
                    <img className={`result-icon ${this.state.hovered ? "result-hover" : ""}`} width="20px" height="20px" src={edit} alt="Edit" onClick={this.onEditStart} />
                    <span className="result-text" onClick={() => { this.props.fetchResults(this.props.id) }}>{this.props.display}</span>
                    <img className={`result-trailer ${this.state.hovered ? "result-hover" : ""}`} width="20px" height="20px" src={cross} alt="Cross" onClick={this.onRemove} />
                </>
            )}
        </div>
    }
}

let mapStateToProps = (state) => {
    return { id: state.id };
};

export default connect(mapStateToProps, { viewStock })(Results);
