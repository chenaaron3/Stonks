import React from 'react';
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, ReferenceLine, ReferenceArea,
    ReferenceDot, Tooltip, CartesianGrid, Legend, Brush, ErrorBar, AreaChart, Area,
    Label, LabelList, Scatter
} from 'recharts';

class Stochastic extends React.Component {
    render() {
        // if graph is not loaded yet
        if (!this.props.graph) {
            return <></>;
        }
        let overbought = this.props.options["overbought"];
        let underbought = this.props.options["underbought"]
        let overboughtLabel = { value: `Overbought(${overbought})`, position: "insideLeft", dy: -10 };
        let underboughtLabel = { value: `Underbought(${underbought})`, position: "insideLeft", dy: 10 };
        return <LineChart data={this.props.graph} syncId="graph" margin={{ top: 0, right: 40, bottom: 0, left: 20 }} height={this.props.height} width={this.props.width}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" minTickGap={50} height={25} tickFormatter={this.props.xAxisTickFormatter} />
            <YAxis label={{ value: "Stochastic", position: "insideLeft", angle: -90, dy: -10 }} domain={[0, 100]} ticks={[0, 100]} />
            <ReferenceLine y={overbought} stroke="red" strokeDasharray="3 3" label={""} />
            <ReferenceLine y={underbought} stroke="green" strokeDasharray="3 3" label={""} />
            <Line dataKey="Stochastic" stroke="#ff7300" dot={false} />
            {this.props.tooltip}
            {this.props.brush}
        </LineChart>
    }
}

export default Stochastic;