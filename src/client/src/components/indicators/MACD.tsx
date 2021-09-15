import React from 'react';
import {
    ResponsiveContainer, ComposedChart, LineChart, Line, Bar, XAxis, YAxis, ReferenceLine, ReferenceArea,
    ReferenceDot, Tooltip, CartesianGrid, Legend, Brush, ErrorBar, AreaChart, Area,
    Label, LabelList, Scatter
} from 'recharts';
import { IndicatorGraphProps } from '../../types/types';

const MACD: React.FC<IndicatorGraphProps> = (props) => {
    // if graph is not loaded yet
    if (!props.graph) {
        return <></>;
    }

    return <ComposedChart data={props.graph} syncId="graph" margin={{ top: 0, right: 40, bottom: 0, left: 20 }} height={props.height} width={props.width}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" minTickGap={50} height={25} tickFormatter={props.xAxisTickFormatter} scale="point" />
        <YAxis label={{ value: "MACD", position: "insideLeft", angle: -90, dy: -10 }} />
        <Bar dataKey="values.Histogram" fill="#413ea0" barSize={10} />
        <Line dataKey="values.MACD" stroke="#ff7300" dot={false} />
        <Line dataKey="values.Signal" stroke="#2ecc71" dot={false} />
        {props.tooltip}
        {props.brush}
    </ComposedChart>
}

export default MACD;