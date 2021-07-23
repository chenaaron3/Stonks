import React, { createRef } from 'react';
import "./SavedResult.css";
import edit from "../edit.svg";
import check from "../check.svg";
import cross from "../cross.svg";
import Pusher from 'react-pusher';

class SavedResult extends React.Component {
    state = { editting: false, display: this.props.display, hovered: false, progress: -1 }

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

    onProgressUpdate = (data) => {
        let progress = data["progress"];
        this.setState({ progress });
    }

    render() {
        if (!this.props.id) {
            return <></>;
        }
        return <>
            <div className="saved-result-background" style={{
                backgroundImage: `linear-gradient(to right, #2ecc71 ${this.state.progress}%, rgb(0, 0, 0, 0) ${this.state.progress}%)`
            }}>
                <div className="saved-result" onMouseEnter={() => this.setState({ hovered: true })} onMouseLeave={() => this.setState({ hovered: false })}>
                    <Pusher
                        channel={this.props.id}
                        event="onProgressUpdate"
                        onUpdate={this.onProgressUpdate}
                    />
                    <Pusher
                        channel={this.props.id}
                        event="onResultsFinished"
                        onUpdate={() => { this.setState(({ progress: -1 })) }}
                    />
                    <Pusher
                        channel={this.props.id}
                        event="onUpdateFinished"
                        onUpdate={() => { this.setState(({ progress: -1 })) }}
                    />
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
                            {
                                this.props.id != process.env.REACT_APP_DEMO_ID && <img className={`saved-result-trailer ${this.state.hovered ? "saved-result-hover" : ""}`} width="20px" height="20px" src={cross} alt="Cross" onClick={this.onRemove} />
                            }
                        </>
                    )}
                </div>
            </div>
        </>
    }
}

export default SavedResult;