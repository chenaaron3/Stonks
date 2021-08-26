import React from 'react';
import {
    ResponsiveContainer, ComposedChart, LineChart, Line, Bar, XAxis, YAxis, ReferenceLine, ReferenceArea,
    ReferenceDot, Tooltip, CartesianGrid, Legend, Brush, ErrorBar, AreaChart, Area,
    Label, LabelList, Scatter
} from 'recharts';

class MACD extends React.Component {
    render() {
        // if graph is not loaded yet
        if (!this.props.graph) {
            return <></>;
        }

        return <ComposedChart data={this.props.graph} syncId="graph" margin={{ top: 0, right: 40, bottom: 0, left: 20 }} height={this.props.height} width={this.props.width}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" minTickGap={50} height={25} tickFormatter={this.props.xAxisTickFormatter} scale="point" />
            <YAxis label={{ value: "MACD", position: "insideLeft", angle: -90, dy: -10 }} />
            <Bar dataKey="Histogram" fill="#413ea0" barSize={10}/>
            <Line dataKey="MACD" stroke="#ff7300" dot={false} />
            <Line dataKey="Signal" stroke="#2ecc71" dot={false} />
            {this.props.tooltip}
            {this.props.brush}
        </ComposedChart>
    }
}

export default MACD;