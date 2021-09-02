import React from 'react';
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, ReferenceLine, ReferenceArea,
    ReferenceDot, Tooltip, CartesianGrid, Legend, Brush, ErrorBar, AreaChart, Area,
    Label, LabelList, Scatter
} from 'recharts';
import { IndicatorGraphProps } from '../../types/types';

const RSI: React.FC<IndicatorGraphProps> = (props) => {
    // if graph is not loaded yet
    if (!props.graph) {
        return <></>;
    }
    let threshold = props.options?.threshold;
    return <LineChart data={props.graph} syncId="graph" margin={{ top: 0, right: 40, bottom: 0, left: 20 }} height={props.height} width={props.width}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" minTickGap={50} height={25} tickFormatter={props.xAxisTickFormatter} />
        <YAxis label={{ value: "ADX", position: "insideLeft", angle: -90, dy: -10 }} domain={[0, (dataMax: number) => (dataMax * 1.1)]} ticks={[0, threshold!]} />
        <ReferenceLine y={threshold} stroke="black" strokeDasharray="3 3" label={""} />
        <Line dataKey="values.ADX" stroke="#ff7300" dot={false} />
        <Line dataKey="values.PDI" stroke="green" dot={false} />
        <Line dataKey="values.NDI" stroke="red" dot={false} />
        {props.tooltip}
        {props.brush}
    </LineChart>
}

export default RSI;