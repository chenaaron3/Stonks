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

class Optimize extends React.Component {
    constructor(props) {
        super(props)
        this.state = { loading: true, scoreBy: "profit", progress: -1, baseID: this.props.id };

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
    }

    fetchOptimizedStoplossTarget = () => {
        console.log("FETCHING OPTIMIZED");
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
                // transform data for chart
                let scores = Object.keys(optimized).map(id => optimized[id]["summary"][this.state.scoreBy]);
                let minScore = Math.min(...scores);
                let maxScore = Math.max(...scores);
                let stoplossTargetData = [];
                Object.keys(optimized).forEach(id => {
                    let strategyOptions = optimized[id]["strategyOptions"];
                    let summary = optimized[id]["summary"];
                    let score = mapRange(summary[this.state.scoreBy], minScore, maxScore, this.minSize, this.maxSize);
                    stoplossTargetData.push({
                        x: strategyOptions["stopLossAtr"].toFixed(2),
                        y: strategyOptions["riskRewardRatio"].toFixed(2),
                        z: summary[this.state.scoreBy].toFixed(2),
                        score: score ? score : 0,
                        id: id
                    });
                })
                this.setState({ baseID, optimized, loading: false, stoplossTargetData });
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

    render() {
        let form = <div className="optimize-card">
            {
                this.fields.map(field => <TextField className="optimize-field" label={camelToDisplay(field)} value={this.state[field]} onChange={(e) => {
                    this.setState({ [field]: e.target.value });
                }} />)
            }
            <Box ml="1vw" ><Button variant="contained" color="primary" onClick={this.requestOptimization}>
                Optimize
            </Button></Box>
        </div>;
        let loading = <div className="optimize-loading">
            <h1>Fetching Optimized Results...</h1>
            <CircularProgress />
        </div>
        let chart = <div className="optimize-chart">
            <ResponsiveContainer width="100%" height={`85%`}>
                <ScatterChart margin={{ top: 0, right: 40, bottom: 40, left: 20 }} >
                    <CartesianGrid />
                    <XAxis type="number" dataKey="x" name="Stoploss" domain={['auto', 'auto']} label={{ value: "Stoploss", position: "insideBottom", offset: -10 }} />
                    <YAxis dataKey="y" name="Risk Reward Ratio" domain={['auto', 'auto']} label={{ value: "Risk Reward Ratio", position: "insideLeft", angle: -90 }} />
                    <ZAxis dataKey="z" name={this.state.scoreBy} />
                    <Scatter data={this.state.stoplossTargetData} fill="#82ca9d" shape={<this.CustomizedDot></this.CustomizedDot>} onClick={(params) => {
                        let url = (process.env.NODE_ENV == "production" ? (process.env.REACT_APP_DOMAIN + process.env.REACT_APP_SUBDIRECTORY) : "localhost:3000") + "/" + params["id"];
                        window.open(url);
                    }} />
                    <Tooltip />
                </ScatterChart >
            </ResponsiveContainer>
        </div>
        return <div className="optimize">
            <Pusher
                channel={this.state.baseID}
                event="onOptimizeProgressUpdate"
                onUpdate={(data) => { this.setState({ progress: data["progress"] }) }}
            />
            <Pusher
                channel={this.state.baseID}
                event="onOptimizeFinished"
                onUpdate={(data) => {
                    this.fetchOptimizedStoplossTarget();
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
            {form}
            {
                this.state.loading && loading
            }
            {
                this.state.optimized && chart
            }
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
}

let mapStateToProps = (state) => {
    let results = state.backtestResults;
    return { results, id: state.id };
};

export default connect(mapStateToProps)(Optimize);