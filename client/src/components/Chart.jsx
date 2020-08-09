import React from 'react';
import { connect } from 'react-redux';
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, ReferenceLine, ReferenceArea,
    ReferenceDot, Tooltip, CartesianGrid, Legend, Brush, ErrorBar, AreaChart, Area,
    Label, LabelList, Scatter
} from 'recharts';
import './Chart.css';

class Chart extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            priceGraph: [],
        }
    }

    componentDidUpdate(prevProps) {
        if (this.props.symbol !== prevProps.symbol && this.props.activeIndicators != prevProps.activeIndicators) {
            // store results to refer back
            this.results = this.props.results;
            this.events = this.props.results["events"];
            // cache all buy/sell dates for quick access
            this.buyDates = new Set();
            this.sellDates = new Set();
            this.events.forEach(event => {
                this.buyDates.add(event["buyDate"]);
                this.sellDates.add(event["sellDate"]);
            })

            // fetch graph data
            this.fetchData();
        }
    }

    fetchData = () => {
        let finalOptions = {};
        this.props.activeIndicators.forEach(activeIndicator => {
            finalOptions[activeIndicator] = this.props.indicatorOptions[activeIndicator];
        });
        let graphData = { symbol: this.props.symbol, indicators: finalOptions };

        fetch(`/priceGraph`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(graphData)
        })
            .then(res => res.json())
            .then(graphs => {
                let combinedGraphs = [];
                let indicatorGraphs = graphs["indicators"];
                graphs["price"].forEach(day => {
                    let date = day["date"];
                    let price = day["adjClose"];
                    let combinedDay = { date, price };
                    Object.keys(indicatorGraphs).forEach(indicatorName => {
                        combinedDay[indicatorName] = indicatorGraphs[indicatorName][date];
                    });
                    combinedGraphs.push(combinedDay);
                });
                console.log(combinedGraphs);
                this.setState({ priceGraph: combinedGraphs });
            })
    }

    yAxisTickFormatter = (value) => getFormattedDate(new Date(value));

    render() {
        // if no symbol, return
        if (!this.props.symbol) {
            return <span className="chart-missing">Run a Strategy!</span>
        }
        let margins = { top: 40, right: 40, bottom: 20, left: 20 };
        return (
            <div className="chart-container">
                <ResponsiveContainer width="100%" height="70%">
                    <LineChart
                        data={this.state.priceGraph} syncId="graph"
                        margin={margins}
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
                        <Line dataKey="SMA" stroke="#ff7300" dot={false} />
                        <Line dataKey="price" stroke="#ff7300" dot={<this.CustomizedDot />} />
                        <Brush gap={10} height={65} dataKey="date" startIndex={this.state.priceGraph.length - 40}>
                            <AreaChart>
                                <CartesianGrid horizontal={false} />
                                <YAxis hide domain={['auto', 'auto']} />
                                <Area dataKey="price" stroke="#ff7300" fill="#ff7300" dot={false} />
                            </AreaChart>
                        </Brush>
                    </LineChart>
                </ResponsiveContainer>
                {/* <LineChart width={1000} height={65} data={this.state.priceGraph} syncId="graph">
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" minTickGap={50} height={75} label={{ value: "Dates", position: "insideTop", offset: 35 }} tickFormatter={this.yAxisTickFormatter} />
                    <YAxis label={{ value: "Prices", position: "insideLeft", angle: -90, dy: -10 }} />
                    <Tooltip/>
                    <Line dataKey={"rsi"} stroke="#ff7300" dot={<this.CustomizedDot />} />
                </LineChart> */}
                {
                    [...this.props.activeIndicators].map(indicatorName => {
                        return <ResponsiveContainer width="100%" height="25%">
                            <LineChart data={this.state.priceGraph} syncId="graph">
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="date" minTickGap={50} height={75} label={{ value: "Dates", position: "insideTop", offset: 35 }} tickFormatter={this.yAxisTickFormatter} />
                                <YAxis label={{ value: indicatorName, position: "insideLeft", angle: -90, dy: -10 }} />
                                <Tooltip />
                                <Line dataKey={indicatorName} stroke="#ff7300" dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    })
                }
            </div>
        );
    }

    CustomizedDot = (props) => {
        const {
            cx, cy, stroke, payload, value,
        } = props;

        let dotRadius = 10;

        // if is a buy date
        if (this.buyDates.has(payload["date"])) {
            return (
                <circle cx={cx} cy={cy} r={dotRadius} stroke="black" strokeWidth={0} fill="green" />
            );
        }
        // if is a sell date
        else if (this.sellDates.has(payload["date"])) {
            return (
                <circle cx={cx} cy={cy} r={dotRadius} stroke="black" strokeWidth={0} fill="red" />
            );
        }
        else if (this.props.results["recent"]["buy"].includes(payload["date"])) {
            return <circle cx={cx} cy={cy} r={dotRadius} stroke="black" strokeWidth={0} fill="yellow" />
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

let mapStateToProps = (state) => {
    return { symbol: state.selectedSymbol, results: state.selectedResults, activeIndicators: [...state.activeIndicators], indicatorOptions: state.indicatorOptions }
};

export default connect(mapStateToProps, null)(Chart);
