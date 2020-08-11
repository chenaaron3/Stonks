import React, { createRef } from 'react';
import caret from "../arrow.svg";
import "./Indicator.css";

class Indicator extends React.Component {
    state = { showFields: false };

    toggleFields = () => {
        this.setState({ showFields: !this.state.showFields });
    }

    render() {
        return (<div className="indicator">
            <div className="indicator-header">
                <input className="indicator-box" type="checkbox" checked={this.props.active} name={this.props.name} value={this.props.name} onChange={(e) => { this.props.setIndicatorOn(this.props.name, e.target.checked) }} />
                <span className="indicator-text">{this.props.name}</span>
                <img className={`indicator-caret${this.state.showFields ? " indicator-show" : ""}`} width="10px" height="10px" src={caret} alt="Arrow" onClick={this.toggleFields} />
            </div>
            <div className={`indicator-fields${this.state.showFields ? " indicator-show" : ""}`}>
                {
                    this.props.fields.map((field, index) => {
                        // use options if exists, else use default
                        let value = (this.props.options && this.props.options.hasOwnProperty(field)) ? this.props.options[field] : this.props.default[index];
                        return (<div key={index}>
                            <label>{field}:</label>
                            <input type="number" name={field} value={value} onChange={(e) => { this.props.setIndicatorOption(this.props.name, field, parseFloat(e.target.value)) }} />
                        </div>);
                    })
                }
            </div>
        </div>);
    }
}

export default Indicator;