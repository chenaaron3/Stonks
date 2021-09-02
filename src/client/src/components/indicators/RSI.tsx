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
    let overbought = props.options?.overbought;
    let underbought = props.options?.underbought;
    let overboughtLabel = { value: `Overbought(${overbought})`, position: "insideLeft", dy: -10 };
    let underboughtLabel = { value: `Underbought(${underbought})`, position: "insideLeft", dy: 10 };
    return <LineChart data={props.graph} syncId="graph" margin={{ top: 0, right: 40, bottom: 0, left: 20 }} height={props.height} width={props.width}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" minTickGap={50} height={25} tickFormatter={props.xAxisTickFormatter} />
        <YAxis label={{ value: "RSI", position: "insideLeft", angle: -90, dy: -10 }} domain={[0, 100]} ticks={[0, 100]} />
        <ReferenceLine y={overbought} stroke="red" strokeDasharray="3 3" label={""} />
        <ReferenceLine y={underbought} stroke="green" strokeDasharray="3 3" label={""} />
        <Line dataKey="values.RSI" stroke="#ff7300" dot={false} />
        {props.tooltip}
        {props.brush}
    </LineChart>
}

export default RSI;