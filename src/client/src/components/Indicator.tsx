import React, { useState } from 'react';
import caret from "../images/arrow.svg";
import "./Indicator.css";
import TextField from '@material-ui/core/TextField';

import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { setIndicatorOption, setIndicatorOn } from '../redux/slices/indicatorSlice';

import IndicatorType from '../types/indicator';

interface IndicatorProps {
    name: IndicatorType.IndicatorNames;
    fields: string[];
    default: number[];
    active: boolean;
    options: IndicatorType.IndicatorParams;
}

const Indicator: React.FC<IndicatorProps> = (props) => {
    const dispatch = useAppDispatch();
    const [showFields, setShowFields] = useState(false);

    const toggleFields = () => {
        setShowFields(!showFields);
    }

    return (<div className="indicator">
        <div className="indicator-header">
            <input className="indicator-box" type="checkbox" checked={props.active} name={props.name} value={props.name} onChange={(e) => {
                // set on state
                dispatch(setIndicatorOn({ indicatorName: props.name, on: e.target.checked }));
                // also open/close fields
                setShowFields(e.target.checked);
            }} />
            <span className="indicator-text">{props.name}</span>
            <img className={`indicator-caret${showFields ? " indicator-show" : ""}`} width="10px" height="10px" src={caret} alt="Arrow" onClick={toggleFields} />
        </div>
        <div className={`indicator-fields${showFields ? " indicator-show" : ""}`}>
            {
                props.fields.map((field, index) => {
                    // use options if exists, else use default
                    let value = (props.options && props.options.hasOwnProperty(field)) ? props.options[field] : props.default[index];
                    return (<div className="indicator-field" key={index}>
                        <TextField label={field} value={value} onChange={(e) => {
                            let newValue = parseFloat(e.target.value);
                            if (!newValue) {
                                newValue = 0;
                            }
                            dispatch(setIndicatorOption({ indicatorName: props.name, field, value: newValue }));
                        }} />
                    </div>);
                })
            }
        </div>
    </div>);
}

export default Indicator;