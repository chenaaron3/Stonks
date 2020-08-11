import React, { createRef } from 'react';
import "./SavedResult.css";
import edit from "../edit.svg";
import check from "../check.svg";
import cross from "../cross.svg";

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
        return <div className="saved-result" onMouseEnter={() => this.setState({ hovered: true })} onMouseLeave={() => this.setState({ hovered: false })}>
            {this.state.editting && (
                <>
                    <img className="saved-result-icon saved-result-hover" width="20px" height="20px" src={check} alt="Check" onClick={this.onEditFinish} />
                    <input className="saved-result-edit" type="text" value={this.state.display} onChange={(e) => { this.setState({ display: e.target.value }); }}></input>
                </>
            )}
            {!this.state.editting && (
                <>
                    <img className={`saved-result-icon ${this.state.hovered ? "saved-result-hover" : ""}`} width="20px" height="20px" src={edit} alt="Edit" onClick={this.onEditStart} />
                    <span className="saved-result-text" onClick={() => { this.props.fetchBacktestResults(this.props.id) }}>{this.props.display}</span>
                    <img className={`saved-result-trailer ${this.state.hovered ? "saved-result-hover" : ""}`} width="20px" height="20px" src={cross} alt="Cross" onClick={this.onRemove} />
                </>
            )}
        </div>
    }
}

export default SavedResult;