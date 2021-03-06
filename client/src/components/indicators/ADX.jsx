import React from 'react';
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, ReferenceLine, ReferenceArea,
    ReferenceDot, Tooltip, CartesianGrid, Legend, Brush, ErrorBar, AreaChart, Area,
    Label, LabelList, Scatter
} from 'recharts';

class RSI extends React.Component {
    render() {
        // if graph is not loaded yet
        if (!this.props.graph) {
            return <></>;
        }
        let threshold = this.props.options["threshold"];
        return <LineChart data={this.props.graph} syncId="graph" margin={{ top: 0, right: 40, bottom: 0, left: 20 }} height={this.props.height} width={this.props.width}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" minTickGap={50} height={25} tickFormatter={this.props.xAxisTickFormatter} />
            <YAxis label={{ value: "ADX", position: "insideLeft", angle: -90, dy: -10 }} domain={[0,  dataMax => (dataMax * 1.1)]} ticks={[0, threshold]} />
            <ReferenceLine y={threshold} stroke="black" strokeDasharray="3 3" label={""} />
            <Line dataKey="ADX" stroke="#ff7300" dot={false} />
            <Line dataKey="PDI" stroke="green" dot={false} />
            <Line dataKey="NDI" stroke="red" dot={false} />
            {this.props.tooltip}
            {this.props.brush}
        </LineChart>
    }
}

export default RSI;