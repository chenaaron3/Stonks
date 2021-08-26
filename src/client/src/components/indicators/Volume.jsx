import React from 'react';
import {
    ResponsiveContainer, ComposedChart, LineChart, Line, Bar, XAxis, YAxis, ReferenceLine, ReferenceArea,
    ReferenceDot, Tooltip, CartesianGrid, Legend, Brush, ErrorBar, AreaChart, Area,
    Label, LabelList, Scatter
} from 'recharts';
import { formatDate, numberWithCommas } from '../../helpers/utils';

class Volume extends React.Component {
    render() {
        // if graph is not loaded yet
        if (!this.props.graph) {
            return <></>;
        }

        let tooltip = <Tooltip
            wrapperStyle={{
                borderColor: 'white',
                boxShadow: '2px 2px 3px 0px rgb(204, 204, 204)',
            }}
            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
            labelStyle={{ fontWeight: 'bold', color: '#666666' }}
            formatter={(value) => {
                if (value) {
                    return numberWithCommas(value);
                }
            }}
            labelFormatter={(label) => formatDate(label)}
        />;

        let yAxisTickFormatter = (value) => {
            let str = value.toString();
            if (str.length > 6) {
                return (value / 1000000) + "m";
            }
            else if (str.length > 3) {
                return (value / 1000) + "k";
            }
            else {
                return value;
            }
        }

        return <ComposedChart data={this.props.graph} syncId="graph" margin={{ top: 0, right: 40, bottom: 0, left: 20 }} height={this.props.height} width={this.props.width}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" minTickGap={50} height={25} tickFormatter={this.props.xAxisTickFormatter} scale="point" />
            <YAxis label={{ value: "Volume", position: "insideLeft", angle: -90, dy: 20 }} tickFormatter={yAxisTickFormatter} />
            <Bar dataKey="volume" fill="#413ea0" barSize={10} />
            {tooltip}
            {this.props.brush}
        </ComposedChart>
    }
}

export default Volume;