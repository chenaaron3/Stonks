import React, { createRef } from 'react';
import LinearProgress from '@material-ui/core/LinearProgress';
import './Loading.css';

interface LoadingParams {
    loading: boolean;
}

const Loading: React.FC<LoadingParams> = (props) => {
    if (props.loading) {
        return <div className="loading">
            <h1 className="loading-text">Loading...</h1>
            <LinearProgress style={{ width: "50vw" }} />
        </div>
    }
    else {
        return <></>
    }
}

export default Loading;