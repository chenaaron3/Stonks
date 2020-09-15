import React, { createRef } from 'react';
import "./SavedResults.css";
import SavedResult from './SavedResult';
import { connect } from 'react-redux';
import { setBacktestResults, setSavedResults, viewStock, setPageIndex } from '../redux';

class SavedResults extends React.Component {
    constructor(props) {
        super(props);
        // create saved results if it doesnt exist
        if (!localStorage.getItem("savedResults")) {
            localStorage.setItem("savedResults", `[{"id":"2O7OFqqI9Z","display":"Demo"}]`)
        }

        this.props.setSavedResults(JSON.parse(localStorage.getItem("savedResults")))
    }

    fetchBacktestResults = (id) => {
        fetch(`${process.env.NODE_ENV == "production" ? process.env.REACT_APP_SUBDIRECTORY : ""}/results?id=${id}`, {
            method: 'GET'
        }).then(res => res.json())
            .then(results => {
                console.log(results["error"]);
                // if results are not ready
                if (results["error"]) {
                    alert(results["error"]);
                }
                else {
                    // store results in global state
                    this.props.setBacktestResults(id, results);
                    // preview first stock
                    this.props.viewStock(Object.keys(results["symbolData"])[0]);
                    // set active page to summary
                    this.props.setPageIndex(1);
                    // go to next page
                    this.props.history.push("/summary");
                }
            });
    }

    // change display name for saved results
    editSavedResults = (id, newDisplay) => {
        let newSave = [];
        this.props.savedResults.forEach(save => {
            if (save["id"] == id) {
                newSave.push({ id, display: newDisplay });
            }
            else {
                newSave.push(save);
            }
        })

        this.props.setSavedResults(newSave);
        localStorage.setItem("savedResults", JSON.stringify(newSave));
    }

    // remove a saved result
    removeSavedResults = (id) => {
        let newSave = [];
        this.props.savedResults.forEach(save => {
            if (save["id"] != id) {
                newSave.push(save);
            }
        })

        this.props.setSavedResults(newSave);
        localStorage.setItem("savedResults", JSON.stringify(newSave));
    }

    render() {
        return <div className="saved-results">
            <h1 className="saved-results-title">Saved Results</h1>
            <div className="saved-results-list">
                {this.props.savedResults.length == 0 && (<span>
                    There are no past results...
                </span>)
                }
                {this.props.savedResults.length != 0 && (
                    this.props.savedResults.map((save, index) => {
                        return <SavedResult id={save["id"]} display={save["display"]} fetchBacktestResults={this.fetchBacktestResults}
                            editSavedResults={this.editSavedResults} removeSavedResults={this.removeSavedResults} key={`saved-results-${index}`} />
                    })
                )
                }
            </div>
        </div>
    }
}

let mapStateToProps = (state) => {
    return { savedResults: state.savedResults };
};

export default connect(mapStateToProps, { setBacktestResults, setSavedResults, viewStock, setPageIndex })(SavedResults);