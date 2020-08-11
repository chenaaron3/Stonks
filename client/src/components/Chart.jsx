import React from 'react';
import { connect } from 'react-redux';
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, ReferenceLine, ReferenceArea,
    ReferenceDot, Tooltip, CartesianGrid, Legend, Brush, ErrorBar, AreaChart, Area,
    Label, LabelList, Scatter
} from 'recharts';
import './Chart.css';

export function largestTriangleThreeBuckets(data, threshold, xAccessor, yAccessor) {
    var floor = Math.floor,
        abs = Math.abs,
        dataLength = data.length,
        sampled = [],
        sampledIndex = 0,
        every = (dataLength - 2) / (threshold - 2), // Bucket size. Leave room for start and end data points
        a = 0, // Initially a is the first point in the triangle
        maxAreaPoint,
        maxArea,
        area,
        nextA,
        i,
        avgX = 0,
        avgY = 0,
        avgRangeStart,
        avgRangeEnd,
        avgRangeLength,
        rangeOffs,
        rangeTo,
        pointAX,
        pointAY;

    if (threshold >= dataLength || threshold === 0) {
        return data; // Nothing to do
    }

    sampled[sampledIndex++] = data[a]; // Always add the first point

    for (i = 0; i < threshold - 2; i++) {
        // Calculate point average for next bucket (containing c)
        avgX = 0;
        avgY = 0;
        avgRangeStart = floor((i + 1) * every) + 1;
        avgRangeEnd = floor((i + 2) * every) + 1;
        avgRangeEnd = avgRangeEnd < dataLength ? avgRangeEnd : dataLength;

        avgRangeLength = avgRangeEnd - avgRangeStart;

        for (; avgRangeStart < avgRangeEnd; avgRangeStart++) {
            avgX += data[avgRangeStart][xAccessor] * 1; // * 1 enforces Number (value may be Date)
            avgY += data[avgRangeStart][yAccessor] * 1;
        }
        avgX /= avgRangeLength;
        avgY /= avgRangeLength;

        // Get the range for this bucket
        rangeOffs = floor((i + 0) * every) + 1;
        rangeTo = floor((i + 1) * every) + 1;

        // Point a
        pointAX = data[a][xAccessor] * 1; // enforce Number (value may be Date)
        pointAY = data[a][yAccessor] * 1;

        maxArea = area = -1;

        for (; rangeOffs < rangeTo; rangeOffs++) {
            // Calculate triangle area over three buckets
            area =
                abs(
                    (pointAX - avgX) * (data[rangeOffs][yAccessor] - pointAY) -
                    (pointAX - data[rangeOffs][xAccessor]) * (avgY - pointAY)
                ) * 0.5;
            if (area > maxArea) {
                maxArea = area;
                maxAreaPoint = data[rangeOffs];
                nextA = rangeOffs; // Next a is this b
            }
        }

        sampled[sampledIndex++] = maxAreaPoint; // Pick this point from the bucket
        a = nextA; // This a is the next a (chosen b)
    }

    sampled[sampledIndex++] = data[dataLength - 1]; // Always add last
    return sampled;
}

class Chart extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            priceGraph: [],
        }
    }

    componentDidUpdate(prevProps) {
        console.log("updating chart");
        if (this.props.symbol != "" && (this.props.symbol !== prevProps.symbol || this.props.activeIndicators != prevProps.activeIndicators)) {
            console.log("before fetch");
            // store results to refer back
            this.results = this.props.results;
            console.log(this.results);
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
                console.log("received data from server");
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

    xAxisTickFormatter = (value) => {
        return getFormattedDate(new Date(value));
    }

    render() {
        // if no symbol, return
        if (!this.props.symbol) {
            return <span className="chart-missing">Run a Strategy!</span>
        }
        let margins = { top: 40, right: 40, bottom: 20, left: 20 };
        let sideChartHeight = 15;
        let mainChartHeight = 100 - this.props.activeIndicators.length * sideChartHeight;
        console.log(mainChartHeight);
        return (
            <div className="chart-container">
                <ResponsiveContainer width="100%" height={`${mainChartHeight}%`}>
                    <LineChart
                        data={this.state.priceGraph} syncId="graph"
                        margin={margins}
                    >
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="date" minTickGap={50} height={75} label={{ value: "Dates", position: "insideTop", offset: 35 }} tickFormatter={this.xAxisTickFormatter} />
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
                        <Line dataKey="price" stroke="#ff7300" dot={<this.CustomizedDot size={10} />} />
                        {/* todo: scale gap to ratio of startindex/endindex */}
                        <Brush gap={25} height={65} dataKey="date" startIndex={this.state.priceGraph.length - 40} onChange={(newRange) => { console.log(newRange) }}>
                            <AreaChart>
                                <CartesianGrid horizontal={false} />
                                <YAxis hide domain={['auto', 'auto']} />
                                <Area dataKey="price" stroke="#ff7300" fill="#ff7300" dot={<this.CustomizedDot size={3} />} />
                            </AreaChart>
                        </Brush>
                    </LineChart>
                </ResponsiveContainer>
                {
                    [...this.props.activeIndicators].map(indicatorName => {
                        return <ResponsiveContainer width="100%" height={`${sideChartHeight}%`}>
                            <LineChart data={this.state.priceGraph} syncId="graph" margin={{ top: 0, right: 40, bottom: 0, left: 20 }}>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="date" minTickGap={50} height={75} tickFormatter={this.xAxisTickFormatter} />
                                <YAxis label={{ value: indicatorName, position: "insideLeft", angle: -90, dy: -10 }} />
                                <Tooltip />
                                <Line dataKey={indicatorName} stroke="#ff7300" dot={false} />
                                <Brush gap={25} width = {0} height={0.00001} dataKey="date" startIndex={this.state.priceGraph.length - 40} onChange={(newRange) => { console.log(newRange) }}/>
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

        let dotRadius = props.size;

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
    console.log("new props in chart");
    return { symbol: state.selectedSymbol, results: state.backtestResults["symbolData"][state.selectedSymbol], activeIndicators: [...state.activeIndicators], indicatorOptions: state.indicatorOptions }
};

export default connect(mapStateToProps, null)(Chart);
