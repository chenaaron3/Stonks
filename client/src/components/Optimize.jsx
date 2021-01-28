import React, { createRef } from 'react';
import { connect } from 'react-redux';
import "./Optimize.css";
import { camelToDisplay, mapRange } from "../helpers/utils"
import TextField from '@material-ui/core/TextField';
import {
    Tooltip, Label, ResponsiveContainer, ScatterChart, Scatter, CartesianGrid, XAxis, YAxis, ZAxis,
} from 'recharts';
import interpolate from 'color-interpolate';
import Button from '@material-ui/core/Button';
import LinearProgress from '@material-ui/core/LinearProgress';
import Box from '@material-ui/core/Box';
import Pusher from 'react-pusher';
import CircularProgress from '@material-ui/core/CircularProgress';
import NavigateNextIcon from '@material-ui/icons/NavigateNext';
import IconButton from '@material-ui/core/IconButton';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import Slider from '@material-ui/core/Slider';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';

class Optimize extends React.Component {
    constructor(props) {
        super(props)
        this.scoreTypes = ["weightedReturns", "equity", "percentProfit", "profit"];
        this.modes = ["stoplossTarget", "indicators"];
        this.state = {
            mode: "stoplossTarget",
            scoreBy: "profit", scoreTypes: [],
            indicator1: "", indicator2: "None", numSectors: 10,
            loading: true, progress: -1, baseID: this.props.id
        };

        // field data
        this.fields = ["startStoploss", "endStoploss", "strideStoploss", "startRatio", "endRatio", "strideRatio"];
        this.defaults = [0, 2, .25, 1, 6, .25]
        this.stoplossFields = this.fields.slice(0, 3);
        this.ratioFields = this.fields.slice(3, this.fields.length);
        this.fields.forEach((f, i) => this.state[f] = this.defaults[i]);

        // score from 0 - 1 to interpolate color
        this.minSize = 0;
        this.maxSize = 1;
        this.colormap = interpolate(["#FFCCCB", "#2ecc71"]);
    }

    componentDidMount() {
        this.fetchOptimizedStoplossTarget();
        this.fetchOptimizedIndicators();
    }

    fetchOptimizedIndicators = () => {
        fetch(`${process.env.NODE_ENV == "production" ? process.env.REACT_APP_SUBDIRECTORY : ""}/optimizedIndicators?id=${this.props.id}`)
            .then(res => res.json())
            .then(optimized => {
                console.log(optimized);
                // not optimized
                if (optimized["error"]) {
                    optimized = undefined;
                    this.setState({ optimized, loading: false });
                    return;
                }

                let allIndicatorData = [];
                let indicatorData = {};
                let data = optimized["data"];
                let symbols = Object.keys(data);
                let fields = data[symbols[0]]["fields"];
                // transform data for chart
                symbols.forEach(symbol => {
                    let events = data[symbol]["data"];
                    let eventIndex = Math.floor(events.length * Math.random());
                    let event = events[eventIndex];
                    // events.forEach(event => {
                    let allIndicatorEntry = { percentProfit: event["percentProfit"] };

                    // record for each indicator field
                    event["indicators"].forEach((v, i) => {
                        if (!indicatorData.hasOwnProperty(fields[i])) {
                            indicatorData[fields[i]] = [];
                        }
                        indicatorData[fields[i]].push({ value: v, percentProfit: event["percentProfit"] });
                        allIndicatorEntry[fields[i]] = v;
                    })

                    // record for indicator combos
                    allIndicatorData.push(allIndicatorEntry);
                    // })
                })
                this.setState({ indicatorData, allIndicatorData, indicatorFields: fields, indicator1: fields[0] });
            });
    }

    fetchOptimizedStoplossTarget = () => {
        // check if already optimized
        fetch(`${process.env.NODE_ENV == "production" ? process.env.REACT_APP_SUBDIRECTORY : ""}/optimizedStoplossTarget?id=${this.props.id}`)
            .then(res => res.json())
            .then(optimized => {
                // not optimized
                if (optimized["error"]) {
                    optimized = undefined;
                    this.setState({ optimized, loading: false });
                    return;
                }

                let baseID = optimized["id"];
                optimized = optimized["results"];
                let optimizedIDs = Object.keys(optimized);
                // transform data for chart
                let scoreTypes = Object.keys(optimized[optimizedIDs[0]]["summary"]);
                scoreTypes.forEach(st => {
                    if (!this.scoreTypes.includes(st)) this.scoreTypes.splice(this.scoreTypes.indexOf(st), 1)
                });
                scoreTypes.sort((st1, st2) => this.scoreTypes.indexOf(st1) - this.scoreTypes.indexOf(st2));
                let scoreBy = scoreTypes[0];
                let scores = optimizedIDs.map(id => optimized[id]["summary"][scoreBy]);
                let minScore = Math.min(...scores);
                let maxScore = Math.max(...scores);
                let stoplossTargetData = [];
                optimizedIDs.forEach(id => {
                    let strategyOptions = optimized[id]["strategyOptions"];
                    let summary = optimized[id]["summary"];
                    let score = mapRange(summary[scoreBy], minScore, maxScore, this.minSize, this.maxSize);
                    stoplossTargetData.push({
                        x: strategyOptions["stopLossAtr"].toFixed(2),
                        y: strategyOptions["riskRewardRatio"].toFixed(2),
                        z: summary[scoreBy].toFixed(2),
                        score: score ? score : 0,
                        id: id
                    });
                })
                this.setState({ baseID, optimized, loading: false, stoplossTargetData, scoreTypes, scoreBy });
            });
    }

    requestOptimization = () => {
        let optimizeOptions = {};
        // error check
        let error = "";
        this.fields.forEach(f => {
            optimizeOptions[f] = parseFloat(this.state[f]);
            if (optimizeOptions[f] == undefined) {
                error = "Invalid field. Must be numbers.";
            }
        });
        if (optimizeOptions["startStoploss"] >= optimizeOptions["endStoploss"] || optimizeOptions["startRatio"] >= optimizeOptions["endRatio"]) {
            error = "End must be greater than Start.";
        }
        if (optimizeOptions["strideStoploss"] <= 0 || optimizeOptions["strideRatio"] <= 0) {
            error = "Stride must be greater than 0.";
        }
        if (error) {
            alert(error);
            return;
        }

        // valid request
        fetch(`${process.env.NODE_ENV == "production" ? process.env.REACT_APP_SUBDIRECTORY : ""}/optimize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id: this.props.id, ...optimizeOptions })
        })
            .then(res => res.json())
            .then(json => {
                this.setState({ baseID: json["id"] });
                alert(json["status"]);
            });
    }

    switchMode = () => {
        if (this.state.mode == "stoplossTarget") {
            this.setState({ mode: "indicators" });
        }
        else {
            this.setState({ mode: "stoplossTarget" });
        }
    }

    yAxisFormatter = (value) => {
        return value.toFixed(2);
    }

    xAxisFormatter = (value) => {
        return value.toFixed(2);
    }

    tooltipFormatter = (value, name, props) => {
        if (name == "price") {
            return [value.toFixed(4), this.props.symbol];
        }
        if (value) {
            try {
                return value.toFixed(4);
            }
            catch {
                if (typeof value == "object") {
                    return "";
                }
                return value;
            }
        }
    }

    render() {
        let tooltip = <Tooltip formatter={this.tooltipFormatter} />

        return <div className="optimize">
            <Pusher
                channel={this.state.baseID}
                event="onOptimizeProgressUpdate"
                onUpdate={(data) => { if (this.state.mode == "stoplossTarget") this.setState({ progress: data["progress"] }) }}
            />
            <Pusher
                channel={this.state.baseID}
                event="onOptimizeIndicatorsProgressUpdate"
                onUpdate={(data) => { if (this.state.mode == "indicators") this.setState({ progress: data["progress"] }) }}
            />
            <Pusher
                channel={this.state.baseID}
                event="onOptimizeFinished"
                onUpdate={(data) => {
                    this.fetchOptimizedStoplossTarget();
                    this.setState({ progress: -1 });
                }}
            />
            <Pusher
                channel={this.state.baseID}
                event="onOptimizeIndicatorsFinished"
                onUpdate={(data) => {
                    this.fetchOptimizedIndicators();
                    this.setState({ progress: -1 });
                }}
            />
            <div className="optimize-header">
                <h3 className="optimize-title">Optimize</h3>
                {
                    this.state.progress != -1 && (
                        <LinearProgress className="optimize-progress" variant="determinate" value={this.state.progress} />
                    )
                }
            </div>
            <div className="optimize-body">
                <IconButton
                    aria-label="more"
                    aria-controls="long-menu"
                    aria-haspopup="true"
                    onClick={this.switchMode}
                    className="optimize-mode"
                    style={{ position: "absolute" }}
                >
                    <NavigateNextIcon />
                </IconButton>
                {
                    this.state.mode == "stoplossTarget" && <>
                        <div className="optimize-card">
                            {
                                this.fields.map(field => <TextField className="optimize-field" key={`optimize-${field}`} label={camelToDisplay(field)} value={this.state[field]}
                                    onChange={(e) => {
                                        this.setState({ [field]: e.target.value });
                                    }} />)
                            }
                            <Box ml="1vw" >
                                <Button variant="contained" color="primary" onClick={this.requestOptimization}>
                                    Optimize
                                </Button>
                            </Box>
                        </div>
                        {
                            this.state.loading && <div className="optimize-loading">
                                <h1>Fetching Optimized Results...</h1>
                                <CircularProgress />
                            </div>
                        }
                        {
                            this.state.optimized && <div className="optimize-chart">
                                <ResponsiveContainer width="100%" height={`85%`}>
                                    <ScatterChart margin={{ top: 0, right: 40, bottom: 40, left: 20 }} >
                                        <CartesianGrid />
                                        <XAxis type="number" dataKey="x" name="Stoploss" domain={[0, 'dataMax']} label={{ value: "Stoploss", position: "insideBottom", offset: -10 }} tickFormatter={this.xAxisFormatter} />
                                        <YAxis type="number" dataKey="y" name="Risk Reward Ratio" domain={[0, 'dataMax']} label={{ value: "Risk Reward Ratio", position: "insideLeft", angle: -90 }} tickFormatter={this.yAxisFormatter} />
                                        <ZAxis dataKey="z" name={camelToDisplay(this.state.scoreBy)} />
                                        <Scatter data={this.state.stoplossTargetData} fill="#82ca9d" shape={<this.CustomizedDot></this.CustomizedDot>} onClick={(params) => {
                                            let url = (process.env.NODE_ENV == "production" ? (process.env.REACT_APP_DOMAIN + process.env.REACT_APP_SUBDIRECTORY) : "localhost:3000") + "/" + params["id"];
                                            window.open(url);
                                        }} />
                                        {tooltip}
                                    </ScatterChart >
                                </ResponsiveContainer>
                            </div>
                        }
                    </>
                }
                {
                    this.state.mode == "indicators" && <>
                        <div className="optimize-card">
                            <Box ml="1vw">
                                <FormControl style={{ minWidth: "5vw" }}>
                                    <InputLabel>Indicator 1</InputLabel>
                                    <Select
                                        value={this.state.indicator1}
                                        onChange={(e) => this.setState({ indicator1: e.target.value })}
                                    >
                                        {
                                            this.state.indicatorFields.map((indicatorField, index) => {
                                                return <MenuItem key={`optimize-indicator1-field-${index}`} value={indicatorField}>{indicatorField}</MenuItem>
                                            })
                                        }
                                    </Select>
                                </FormControl>
                            </Box>
                            <Box ml="1vw">
                                <FormControl style={{ minWidth: "5vw" }}>
                                    <InputLabel>Indicator 2</InputLabel>
                                    <Select
                                        value={this.state.indicator2}
                                        onChange={(e) => this.setState({ indicator2: e.target.value })}
                                    >
                                        <MenuItem key={`optimize-indicator1-field-none`} value={"None"}>None</MenuItem>
                                        {
                                            this.state.indicatorFields.map((indicatorField, index) => {
                                                return <MenuItem key={`optimize-indicator1-field-${index}`} value={indicatorField}>{indicatorField}</MenuItem>
                                            })
                                        }
                                    </Select>
                                </FormControl>
                            </Box>
                            <Box mx="1vw" mt="1vh">
                                <FormControl style={{ minWidth: "5vw" }}>
                                    <InputLabel># Sectors</InputLabel>
                                    <Slider
                                        defaultValue={50}
                                        aria-labelledby="discrete-slider"
                                        valueLabelDisplay="auto"
                                        value={this.state.numSectors}
                                        onChange={(e, v) => { this.setState({ numSectors: v }) }}
                                        step={1}
                                        marks
                                        min={1}
                                        max={20}
                                    />
                                </FormControl>
                            </Box>
                            <Box ml="1vw" >
                                <Button variant="contained" color="primary" onClick={() => { }}>
                                    Apply
                                </Button>
                            </Box>
                        </div>
                        {
                            this.state.indicator2 == "None" && <div className="optimize-chart">
                                <ResponsiveContainer width="100%" height={`85%`}>
                                    <ScatterChart margin={{ top: 0, right: 40, bottom: 40, left: 20 }} >
                                        <CartesianGrid />
                                        <XAxis type="number" dataKey="value" name={this.state.indicator1} domain={['dataMin', 'dataMax']} label={{ value: this.state.indicator1, position: "insideBottom", offset: -10 }} tickFormatter={this.xAxisFormatter} />
                                        <YAxis type="number" dataKey="percentProfit" name="Percent Profit" domain={['dataMin', 'dataMax']} label={{ value: "Percent Profit", position: "insideLeft", angle: -90 }} tickFormatter={this.yAxisFormatter} />
                                        <Scatter data={this.state.indicatorData[this.state.indicator1]} fill="#82ca9d" shape={<this.IndicatorDot />} />
                                        {tooltip}
                                    </ScatterChart >
                                </ResponsiveContainer>
                            </div>
                        }
                        {
                            (this.state.indicator2 != "None" && this.state.allIndicatorData) && <div className="optimize-chart">
                                <ResponsiveContainer width="100%" height={`85%`}>
                                    <ScatterChart margin={{ top: 0, right: 40, bottom: 40, left: 20 }} >
                                        <CartesianGrid />
                                        <XAxis type="number" dataKey={this.state.indicator1} name={this.state.indicator1} domain={['dataMin', 'dataMax']} label={{ value: this.state.indicator1, position: "insideBottom", offset: -10 }} tickFormatter={this.xAxisFormatter} />
                                        <YAxis type="number" dataKey={this.state.indicator2} name={this.state.indicator2} domain={['dataMin', 'dataMax']} label={{ value: this.state.indicator2, position: "insideLeft", angle: -90 }} tickFormatter={this.yAxisFormatter} />
                                        <Scatter data={this.state.allIndicatorData} fill="#82ca9d" shape={<this.IndicatorDot />} />
                                        {tooltip}
                                    </ScatterChart >
                                </ResponsiveContainer>
                            </div>
                        }
                    </>
                }
            </div>
        </div>;
    }

    CustomizedDot = (props) => {
        const {
            cx, cy, stroke, payload, value,
        } = props;

        let dotRadius = props.score * 10 + 5;
        if (props.score == this.maxSize) {
            return <rect x={cx - dotRadius} y={cy - dotRadius} width={dotRadius * 2} height={dotRadius * 2} stroke="black" strokeWidth={0} fill={this.colormap(props.score)} />;
        }
        return (
            <circle cx={cx} cy={cy} r={dotRadius} stroke="black" strokeWidth={0} fill={this.colormap(props.score)} />
        );
    }

    IndicatorDot = (props) => {
        const {
            cx, cy, stroke, payload, value,
        } = props;

        let dotRadius = 10;
        if (props.percentProfit > 0) {
            return <circle cx={cx} cy={cy} r={dotRadius} stroke="black" strokeWidth={0} fill={this.colormap(1)} />
        }
        return (
            <circle cx={cx} cy={cy} r={dotRadius} stroke="black" strokeWidth={0} fill={this.colormap(0)} />
        );
    }
}

let mapStateToProps = (state) => {
    let results = state.backtestResults;
    return { results, id: state.id };
};

export default connect(mapStateToProps)(Optimize);