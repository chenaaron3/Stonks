import React from 'react';
import { connect } from 'react-redux';
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, ReferenceLine, ReferenceArea,
    ReferenceDot, Tooltip, CartesianGrid, Legend, Brush, ErrorBar, AreaChart, Area,
    Label, LabelList, Scatter
} from 'recharts';
import './Chart.css';

let mapStateToProps = (state) => {
    return { symbol: state.selectedSymbol, results: state.selectedResults }
};

class Chart extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            priceGraph: [],
        }
    }

    // componentDidMount() {
    //     this.fetchData();
    // }

    componentDidUpdate(prevProps) {
        if (this.props.symbol !== prevProps.symbol) {
            this.fetchData();
            this.results = this.props.results;
            this.events = this.props.results["events"];
            this.buyDates = new Set();
            this.sellDates = new Set();
            this.events.forEach(event => {
                this.buyDates.add(event["buyDate"]);
                this.sellDates.add(event["sellDate"]);
            })
        }
    }

    fetchData = () => {
        fetch(`/priceGraph?symbol=${this.props.symbol}`)
            .then(res => res.json())
            .then(priceGraph => {
                this.setState({ priceGraph: priceGraph });
            })
    }

    yAxisTickFormatter = (value) => getFormattedDate(new Date(value));

    render() {
        // if no symbol, return
        if (!this.props.symbol) {
            return <span className="chart-missing">Run a Strategy!</span>
        }
        return (
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    width={1000} height={400} data={this.state.priceGraph}
                    margin={{ top: 40, right: 40, bottom: 20, left: 20 }}
                >
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" minTickGap={50} height={75} label={{ value: "Dates", position: "insideTop", offset: 35 }} tickFormatter={this.yAxisTickFormatter} />
                    <YAxis label={{ value: "Prices", position: "insideLeft", angle: -90, dy: -10 }} />
                    <Tooltip
                        wrapperStyle={{
                            borderColor: 'white',
                            boxShadow: '2px 2px 3px 0px rgb(204, 204, 204)',
                        }}
                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
                        labelStyle={{ fontWeight: 'bold', color: '#666666' }}
                    />
                    <Line dataKey="adjClose" stroke="#ff7300" dot={<this.CustomizedDot />} />
                    <Brush gap={10} height={65} dataKey="date" startIndex={this.state.priceGraph.length - 40}>
                        <AreaChart>
                            <CartesianGrid horizontal={false} />
                            <YAxis hide domain={['auto', 'auto']} />
                            <Area dataKey="adjClose" stroke="#ff7300" fill="#ff7300" dot={false} />
                        </AreaChart>
                    </Brush>
                </LineChart>
            </ResponsiveContainer>
        );
    }

    CustomizedDot = (props) => {
        const {
            cx, cy, stroke, payload, value,
        } = props;

        let dotRadius = 10;

        if (this.buyDates.has(payload["date"])) {
            return (
                <circle cx={cx} cy={cy} r={dotRadius} stroke="black" strokeWidth={0} fill="green" />
            );
        }

        else if (this.sellDates.has(payload["date"])) {
            return (
                <circle cx={cx} cy={cy} r={dotRadius} stroke="black" strokeWidth={0} fill="red" />
            );
        }

        return (
            <div></div>
        );
    };
}

function getFormattedDate(date) {
    if (typeof date == "string") {
        date = new Date(date);
    }
    var year = date.getFullYear();

    var month = (1 + date.getMonth()).toString();
    month = month.length > 1 ? month : '0' + month;

    var day = date.getDate().toString();
    day = day.length > 1 ? day : '0' + day;

    return month + '/' + day + '/' + year;
}

export default connect(mapStateToProps, null)(Chart);
