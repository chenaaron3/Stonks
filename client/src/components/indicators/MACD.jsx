import React from 'react';
import {
    ResponsiveContainer, ComposedChart, LineChart, Line, Bar, XAxis, YAxis, ReferenceLine, ReferenceArea,
    ReferenceDot, Tooltip, CartesianGrid, Legend, Brush, ErrorBar, AreaChart, Area,
    Label, LabelList, Scatter
} from 'recharts';

const data = [{ name: 'Page A', uv: 590, pv: 800, amt: 1400 },
{ name: 'Page B', uv: 868, pv: 967, amt: 1506 },
{ name: 'Page C', uv: 1397, pv: 1098, amt: 989 },
{ name: 'Page D', uv: 1480, pv: 1200, amt: 1228 },
{ name: 'Page E', uv: 1520, pv: 1108, amt: 1100 },
{ name: 'Page F', uv: 1400, pv: 680, amt: 1700 }];

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