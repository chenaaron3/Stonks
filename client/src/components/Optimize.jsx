import React, { createRef } from 'react';
import { connect } from 'react-redux';
import "./Optimize.css";
import { camelToDisplay } from "../helpers/utils"
import TextField from '@material-ui/core/TextField';

class Optimize extends React.Component {
    state = {};

    constructor(props) {
        super(props)
        this.fields = ["startStoploss", "endStoploss", "strideStoploss", "startRatio", "endRatio", "strideRatio"];
        this.fields.forEach(f => this.state[f] = 0);

        // check if already optimized
    }

    render() {
        return <div className="optimize">
            <h3 className="optimize-title">Optimize</h3>
            <div className="optimize-card">
                {
                    this.fields.map(field => <TextField className="optimize-field" label={camelToDisplay(field)} value={this.state[field]} onChange={(e) => {
                        this.setState({ [field]: e.target.value });
                    }} />)
                }
            </div>
        </div>;
    }
}

let mapStateToProps = (state) => {
    let results = state.backtestResults;
    return { results, id: state.id };
};

export default connect(mapStateToProps)(Optimize);