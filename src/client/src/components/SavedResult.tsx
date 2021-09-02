import React, { useState } from 'react';
import "./SavedResult.css";
import edit from "../images/edit.svg";
import check from "../images/check.svg";
import cross from "../images/cross.svg";
import Pusher from 'react-pusher';

interface SavedResultProps {
    id: string;
    display: string;
    fetchBacktestResults: (id: string) => void;
    editSavedResults: (id: string, newDisplay: string) => void;
    removeSavedResults: (id: string) => void;
}

const SavedResult: React.FC<SavedResultProps> = (props) => {
    const [editting, setEditting] = useState(false);
    const [display, setDisplay] = useState(props.display);
    const [hovered, setHovered] = useState(false);
    const [progress, setProgress] = useState(-1);

    const onRemove = () => {
        props.removeSavedResults(props.id);
    }

    const onEditStart = () => {
        setEditting(true);
    }

    const onEditFinish = () => {
        props.editSavedResults(props.id, display);
        setEditting(false);
    }

    const onProgressUpdate = (data: { progress: number }) => {
        let progress = data["progress"];
        setProgress(progress);
    }

    if (!props.id) {
        return <></>;
    }
    return <>
        <div className="saved-result-background" style={{
            backgroundImage: `linear-gradient(to right, #2ecc71 ${progress}%, rgb(0, 0, 0, 0) ${progress}%)`
        }}>
            <div className="saved-result" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
                <Pusher
                    channel={props.id}
                    event="onProgressUpdate"
                    onUpdate={onProgressUpdate}
                />
                <Pusher
                    channel={props.id}
                    event="onResultsFinished"
                    onUpdate={() => { setProgress(-1) }}
                />
                <Pusher
                    channel={props.id}
                    event="onUpdateFinished"
                    onUpdate={() => { setProgress(-1) }}
                />
                {editting && (
                    <>
                        <img className="saved-result-icon saved-result-hover" width="20px" height="20px" src={check} alt="Check" onClick={onEditFinish} />
                        <input className="saved-result-edit" type="text" value={display} onChange={(e) => { setDisplay(e.target.value) }}></input>
                    </>
                )}
                {!editting && (
                    <>
                        <img className={`saved-result-icon ${hovered ? "saved-result-hover" : ""}`} width="20px" height="20px" src={edit} alt="Edit" onClick={onEditStart} />
                        <span className="saved-result-text" onClick={() => { props.fetchBacktestResults(props.id) }}>{props.display}</span>
                        {
                            props.id != process.env.REACT_APP_DEMO_ID && <img className={`saved-result-trailer ${hovered ? "saved-result-hover" : ""}`} width="20px" height="20px" src={cross} alt="Cross" onClick={onRemove} />
                        }
                    </>
                )}
            </div>
        </div>
    </>
}

export default SavedResult;