import React, { createRef } from 'react';
import caret from "../arrow.svg";
import "./Indicator.css";
import TextField from '@material-ui/core/TextField';

class Indicator extends React.Component {
    state = { showFields: false };

    toggleFields = () => {
        this.setState({ showFields: !this.state.showFields });
    }

    render() {
        return (<div className="indicator">
            <div className="indicator-header">
                <input className="indicator-box" type="checkbox" checked={this.props.active} name={this.props.name} value={this.props.name} onChange={(e) => {
                    // set on state
                    this.props.setIndicatorOn(this.props.name, e.target.checked);
                    // also open/close fields
                    this.setState({ showFields: e.target.checked });
                }} />
                <span className="indicator-text">{this.props.name}</span>
                <img className={`indicator-caret${this.state.showFields ? " indicator-show" : ""}`} width="10px" height="10px" src={caret} alt="Arrow" onClick={this.toggleFields} />
            </div>
            <div className={`indicator-fields${this.state.showFields ? " indicator-show" : ""}`}>
                {
                    this.props.fields.map((field, index) => {
                        // use options if exists, else use default
                        let value = (this.props.options && this.props.options.hasOwnProperty(field)) ? this.props.options[field] : this.props.default[index];
                        return (<div className="indicator-field" key={index}>
                            <TextField label={field} value={value} onChange={(e) => {
                                let newValue = parseFloat(e.target.value);
                                if (!newValue) {
                                    newValue = 0;
                                }
                                this.props.setIndicatorOption(this.props.name, field, newValue);
                            }} />
                        </div>);
                    })
                }
            </div>
        </div>);
    }
}

export default Indicator;