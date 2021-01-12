import React, { createRef } from 'react';
import LinearProgress from '@material-ui/core/LinearProgress';
import './Loading.css';

class Loading extends React.Component {
    render() {
        if (this.props.loading) {
            return <div className="loading">
                <h1 className="loading-text">Loading...</h1>
                <LinearProgress style={{ width: "50vw" }} />
            </div>
        }
        else {
            return <></>
        }
    }
}

export default Loading;