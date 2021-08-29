import React, {  } from 'react';
import { connect } from 'react-redux';
import "./Optimize.css";
import { camelToDisplay, mapRange, findOptimalMetric } from "../helpers/utils"
import TextField from '@material-ui/core/TextField';
import {
    Tooltip, Label, ResponsiveContainer, ScatterChart, Scatter, CartesianGrid, XAxis, YAxis, ZAxis, ReferenceArea
} from 'recharts';
import { mean, median, standardDeviation, min, max } from 'simple-statistics'
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
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Switch from '@material-ui/core/Switch';
import { setBacktestResults } from '../redux';

class Optimize extends React.Component {
    constructor(props) {
        super(props)
        this.scoreTypes = ["sharpe", "weightedReturns", "equity", "percentProfit", "profit"];
        this.modes = ["stoplossTarget", "indicators"];
        this.state = {
            mode: "stoplossTarget",
            scoreBy: "Score", scoreTypes: [],
            indicator1: "", indicator2: "None", numSectors: 10, applySectors: .5, sectors: [], showSectors: true,
            loadingStoplossTarget: true, loadingIndicators: true, progress: -1, baseID: this.props.id
        };

        // field data
        this.fields = ["startStoploss", "endStoploss", "strideStoploss", "startRatio", "endRatio", "strideRatio"];
        this.defaults = [0, 2, .5, 1, 6, .5]
        this.stoplossFields = this.fields.slice(0, 3);
        this.ratioFields = this.fields.slice(3, this.fields.length);
        this.fields.forEach((f, i) => this.state[f] = this.defaults[i]);

        // score from 0 - 1 to interpolate color
        this.minSize = 0;
        this.maxSize = 1;
        this.colormap = interpolate(["#FFCCCB", "#2ecc71"]);
        this.highlightColormap = interpolate(["red", "green"]);
        this.winColormap = interpolate(["#2ecc71", "green"]);
        this.lossColormap = interpolate(["#FFCCCB", "red"]);
    }

    async componentDidMount() {
        await this.fetchResults();
        this.fetchOptimizedStoplossTarget();
        this.fetchOptimizedIndicators();
    }

    // componentDidUpdate(prevProps) {
    //     let events = 0;
    //     let symbols = Object.keys(this.props["results"]["symbolData"]);
    //     symbols.forEach(symbol => {
    //         events += this.props["results"]["symbolData"][symbol]["events"].length;
    //     })
    //     console.log("NUM EVENTS", events);        
    // }

    fetchResults() {
        // fetch results again in case we modified it before
        return new Promise(resolve => {
            fetch(`${process.env.NODE_ENV == "production" ? process.env.REACT_APP_SUBDIRECTORY : ""}/results?id=${this.props.id}`, {
                method: 'GET'
            }).then(res => res.json())
                .then(results => {
                    this.props.setBacktestResults(this.props.id, results);
                    resolve();
                });
        });
    }

    fetchOptimizedIndicators = () => {
        fetch(`${process.env.NODE_ENV == "production" ? process.env.REACT_APP_SUBDIRECTORY : ""}/optimizedIndicators?id=${this.props.id}`)
            .then(res => res.json())
            .then(optimized => {
                console.log(optimized);
                // not optimized
                if (optimized["error"]) {
                    optimized = undefined;
                    this.setState({ loadingIndicators: false });
                    return;
                }

                let data = optimized;
                let symbols = Object.keys(data);
                let fields = data[symbols[0]]["fields"];
                let allIndicatorData = { events: [], stats: {}, generalStats: {} }; // contains all events, stats for all fields
                let combinedIndicatorData = []; // contains all indicator averages
                let indicatorData = {}; // maps indicator to averages
                fields.forEach(field => {
                    indicatorData[field] = []
                });

                // transform data for chart
                symbols.forEach(symbol => {
                    let events = data[symbol]["data"];
                    let flattenedData = {};
                    let stats = {};
                    let percentProfits = [];

                    // initialize lists
                    fields.forEach(field => {
                        flattenedData[field] = [];
                    })

                    let faulty = false;
                    // convert data into lists
                    events.forEach((event, i) => {
                        let matchingEvent = this.props.results["symbolData"][symbol]["events"][i];
                        // if available, match events by buy date
                        if (event["buyDate"]) {
                            matchingEvent = this.props.results["symbolData"][symbol]["events"].find(e => e["buyDate"] == event["buyDate"])
                        }
                        if (!matchingEvent) {
                            faulty = true;
                            return;
                        }

                        // track symbol and buyDate to match later on
                        event["symbol"] = symbol;
                        event["buyDate"] = matchingEvent["buyDate"];
                        allIndicatorData["events"].push(event);
                        percentProfits.push(event["percentProfit"]);
                        // record for each indicator field
                        event["indicators"].forEach((v, i) => {
                            if (!v) faulty = true;
                            flattenedData[fields[i]].push(v);
                        })
                    })
                    if (faulty) return;

                    // average out events for each symbol to create a point on the scatter chart                     
                    stats["percentProfit"] = mean(percentProfits);
                    let combinedIndicatorEntry = { percentProfit: stats["percentProfit"] };
                    Object.keys(flattenedData).forEach(indicatorField => {
                        let indicatorEntry = {};
                        indicatorEntry["value"] = mean(flattenedData[indicatorField]);
                        indicatorEntry["percentProfit"] = stats["percentProfit"];
                        indicatorData[indicatorField].push(indicatorEntry);
                        combinedIndicatorEntry[indicatorField] = indicatorEntry["value"];
                    })
                    combinedIndicatorData.push(combinedIndicatorEntry);
                });

                // calculate stats for all data
                fields.forEach((field, fieldIndex) => {
                    let flattened = [];
                    allIndicatorData["events"].forEach(event => {
                        if (event["indicators"][fieldIndex]) {
                            flattened.push(event["indicators"][fieldIndex]);
                        }
                    });
                    allIndicatorData["stats"][field] = {
                        mean: mean(flattened),
                        median: median(flattened),
                        standardDeviation: standardDeviation(flattened)
                    }
                })
                // calculate percent profits
                let flattened = [];
                allIndicatorData["events"].forEach(event => {
                    flattened.push(event["percentProfit"]);
                });
                allIndicatorData["stats"]["percentProfit"] = {
                    min: min(flattened),
                    max: max(flattened),
                    mean: mean(flattened),
                    median: median(flattened),
                    standardDeviation: standardDeviation(flattened)
                };

                this.setState({ allIndicatorData, indicatorData, combinedIndicatorData, indicatorFields: fields, indicator1: fields[0], loadingIndicators: false },
                    () => {
                        this.setSectors();
                    });
            });
    }

    fetchOptimizedStoplossTarget = () => {
        return new Promise((resolve, reject) => {
            // check if already optimized
            fetch(`${process.env.NODE_ENV == "production" ? process.env.REACT_APP_SUBDIRECTORY : ""}/optimizedStoplossTarget?id=${this.props.id}`)
                .then(res => res.json())
                .then(optimized => {
                    // not optimized
                    if (optimized["error"]) {
                        this.setState({ loadingStoplossTarget: false });
                        reject();
                        return;
                    }

                    let baseID = optimized["id"];
                    optimized = optimized["results"];
                    let optimizedIDs = Object.keys(optimized);
                    // transform data for chart
                    let metrics = optimizedIDs.map(optimizedID => optimized[optimizedID]["summary"]);
                    let { scores } = findOptimalMetric(metrics);
                    let minScore = Math.min(...scores);
                    let maxScore = Math.max(...scores);

                    let stoplossTargetData = [];
                    optimizedIDs.forEach((id, i) => {
                        let strategyOptions = optimized[id]["strategyOptions"];
                        let score = mapRange(scores[i], minScore, maxScore, this.minSize, this.maxSize);
                        stoplossTargetData.push({
                            x: strategyOptions["stopLossAtr"].toFixed(2),
                            y: strategyOptions["riskRewardRatio"].toFixed(2),
                            z: score.toFixed(2),
                            score: score ? score : 0,
                            id: id,
                            metrics: metrics[i]
                        });
                    })
                    this.setState({ baseID, optimized, loadingStoplossTarget: false, stoplossTargetData }, resolve);
                });
        })
    }

    requestStoplossTargetOptimization = () => {
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
        fetch(`${process.env.NODE_ENV == "production" ? process.env.REACT_APP_SUBDIRECTORY : ""}/optimizeStoplossTarget`, {
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

    requestIndicatorOptimization = () => {
        fetch(`${process.env.NODE_ENV == "production" ? process.env.REACT_APP_SUBDIRECTORY : ""}/optimizeIndicators`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id: this.props.id })
        })
            .then(res => res.json())
            .then(json => {
                this.setState({ baseID: json["id"] });
                alert(json["status"]);
            });
    }

    setSectors = () => {
        if (!this.state.indicator1) return;
        let fieldIndex = this.state.indicatorFields.indexOf(this.state.indicator1);
        let sectors = [];
        let domain = this.getDomain(this.state.indicator1);
        let range = domain[1] - domain[0];
        let sectorSize = range / this.state.numSectors;
        let minPercentProfit = 100;
        let maxPercentProfit = -100;
        // split up each sector and calculate their profits
        for (let i = 0; i < this.state.numSectors; ++i) {
            let sector = {
                x1: domain[0] + sectorSize * i,
                x2: domain[0] + sectorSize * (i + 1),
                y1: this.state.allIndicatorData["stats"]["percentProfit"]["min"],
                y2: this.state.allIndicatorData["stats"]["percentProfit"]["max"],
                events: []
            };
            let percentProfit = 0;
            let count = 0;
            this.state.allIndicatorData["events"].forEach(event => {
                let v = event["indicators"][fieldIndex];
                // within sector
                if (v >= sector["x1"] && v < sector["x2"]) {
                    sector["events"].push(event);
                    percentProfit += event["percentProfit"];
                    count += 1;
                }
            })
            sector["percentProfit"] = percentProfit / count;
            sector["count"] = count;
            if (sector["percentProfit"] < minPercentProfit) minPercentProfit = sector["percentProfit"];
            if (sector["percentProfit"] > maxPercentProfit) maxPercentProfit = sector["percentProfit"];
            sectors.push(sector);
        }

        // score each sector relative to each other to assign color
        sectors.forEach(sector => {
            let score = mapRange(sector["percentProfit"], 0, maxPercentProfit, 0, 1);
            let fill = ""
            if (score) {
                fill = this.highlightColormap(score);
            }
            else {
                // no data
                fill = "none";
            }
            sector["score"] = score;
            if (sector["percentProfit"] > 0) {
                // score = mapRange(sector["percentProfit"], 0, maxPercentProfit, 0, 1);
                // fill = this.winColormap(score);
                sector["fill"] = fill;
            }
            else {
                // let score = mapRange(sector["percentProfit"], 0, minPercentProfit, 0, 1);
                // fill = this.lossColormap(score);
                sector["fill"] = fill;
            }
        });
        sectors.sort((a, b) => b["score"] - a["score"]);

        this.setState({ sectors });
    }

    applySectors = () => {
        let top = Math.floor(this.state.numSectors * this.state.applySectors);
        let newResults = this.props.results;
        for (let i = 0; i < top; ++i) {
            let sector = this.state.sectors[i];
            // tag events to be removed
            sector["events"].forEach(event => {
                let actualEvents = newResults["symbolData"][event["symbol"]]["events"];
                for (let eventIndex = 0; eventIndex < actualEvents.length; ++eventIndex) {
                    let e = actualEvents[eventIndex];
                    // keep event if buy date matches
                    if (e["buyDate"] == event["buyDate"]) {
                        e["keep"] = true;
                    }
                }
            })
        }

        // does the actual removal
        let filtered = 0;
        Object.keys(newResults["symbolData"]).forEach(symbol => {
            let newEvents = newResults["symbolData"][symbol]["events"].filter(event => event["keep"]);
            // remove the tag
            newEvents.forEach(e => delete e["keep"]);
            newResults["symbolData"][symbol]["events"] = newEvents;
            filtered += newEvents.length;
        })

        // update redux
        this.props.setBacktestResults(this.props.id, newResults);
        alert("Kept " + filtered + " events");
    }

    switchMode = () => {
        if (this.state.mode == "stoplossTarget") {
            this.setState({ mode: "indicators" });
        }
        else {
            this.setState({ mode: "stoplossTarget" });
        }
    }

    getDomain = (field) => {
        let deviations = 2;
        let mean = this.state.allIndicatorData["stats"][field]["mean"];
        let standardDeviation = this.state.allIndicatorData["stats"][field]["standardDeviation"];
        let domain = [mean - deviations * standardDeviation, mean + deviations * standardDeviation];
        let onlyPositive = ["Head_Ratio", "Leg_Ratio"];
        if (onlyPositive.includes(field)) {
            domain[0] = Math.max(0, domain[0]);
        }
        return domain;
    }

    yAxisFormatter = (value) => {
        return value.toFixed(2);
    }

    xAxisFormatter = (value) => {
        return value.toFixed(2);
    }

    tooltipFormatter = (value, name, props) => {
        if (name == "Score") {
            let metricNames = Object.keys(props["payload"]["metrics"]);
            return [<>
                {value}<br />
                {metricNames.map(metricName => <>
                    {camelToDisplay(metricName)}: {props["payload"]["metrics"][metricName].toFixed(2)}<br />
                </>)}
            </>, name]
        }
        if (value) {
            try {
                return value.toFixed(4);
            }
            catch {
                if (typeof value == "object") {
                    return JSON.stringify(value);
                }
                return value;
            }
        }
    }

    render() {
        let tooltip = <Tooltip formatter={this.tooltipFormatter} />
        console.log(this.state);

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
                <h3 className="optimize-title">Optimize {camelToDisplay(this.state.mode)}</h3>
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
                                <Button variant="contained" color="primary" onClick={this.requestStoplossTargetOptimization}>
                                    Optimize
                                </Button>
                            </Box>
                        </div>
                        {
                            this.state.loadingStoplossTarget && <div className="optimize-loading">
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
                                        <ZAxis dataKey="z" name="Score" />
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
                        {
                            !this.state.indicatorData && <>
                                <div className="optimize-card" style={{ justifyContent: "center" }}>
                                    <Box ml="1vw" >
                                        <Button variant="contained" color="primary" onClick={this.requestIndicatorOptimization}>
                                            Optimize
                                        </Button>
                                    </Box>
                                </div>
                            </>
                        }
                        {
                            this.state.loadingIndicators && <div className="optimize-loading">
                                <h1>Fetching Indicator Data...</h1>
                                <CircularProgress />
                            </div>
                        }
                        {
                            this.state.indicatorData && <><div className="optimize-card">
                                <Box ml="1vw">
                                    <FormControl style={{ minWidth: "5vw" }}>
                                        <InputLabel>Indicator 1</InputLabel>
                                        <Select
                                            value={this.state.indicator1}
                                            onChange={(e) => this.setState({ indicator1: e.target.value }, this.setSectors)}
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
                                            onChange={(e) => this.setState({ indicator2: e.target.value }, this.setSectors)}
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
                                            onChange={(e, v) => { this.setState({ numSectors: v }, this.setSectors) }}
                                            step={1}
                                            marks
                                            min={1}
                                            max={20}
                                        />
                                    </FormControl>
                                </Box>
                                <Box mx="1vw" mt="1vh">
                                    <FormControl style={{ minWidth: "5vw" }}>
                                        <InputLabel>Apply Sectors</InputLabel>
                                        <Slider
                                            defaultValue={.5}
                                            aria-labelledby="discrete-slider"
                                            valueLabelDisplay="auto"
                                            value={this.state.applySectors}
                                            onChange={(e, v) => { this.setState({ applySectors: v }) }}
                                            step={.1}
                                            marks
                                            min={0}
                                            max={1}
                                        />
                                    </FormControl>
                                </Box>
                                <Box mx="1vw" mt="1vh">
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={this.state.showSectors}
                                                onChange={(e) => { this.setState({ showSectors: e.target.checked }) }}
                                                color="primary"
                                            />
                                        }
                                        label="Show Sectors"
                                    />
                                </Box>
                                <Box ml="1vw" >
                                    <Button variant="contained" color="primary" onClick={this.applySectors}>
                                        Apply
                                </Button>
                                </Box>
                            </div>
                                {
                                    this.state.indicator2 == "None" && <div className="optimize-chart">
                                        <ResponsiveContainer width="100%" height={`85%`}>
                                            <ScatterChart margin={{ top: 0, right: 40, bottom: 40, left: 20 }} >
                                                <CartesianGrid />
                                                <XAxis type="number" dataKey="value" name={this.state.indicator1}
                                                    domain={[(dataMin) => this.getDomain(this.state.indicator1)[0], (dataMax) => this.getDomain(this.state.indicator1)[1]]}
                                                    label={{ value: this.state.indicator1, position: "insideBottom", offset: -10 }} tickFormatter={this.xAxisFormatter}
                                                    ticks={this.state.sectors.map(sector => sector["x1"])} interval={0} />
                                                <YAxis type="number" dataKey="percentProfit" name="Percent Profit" domain={['dataMin', 'dataMax']}
                                                    label={{ value: "Percent Profit", position: "insideLeft", angle: -90 }} tickFormatter={this.yAxisFormatter} />
                                                <Scatter data={this.state.indicatorData[this.state.indicator1]} fill="#82ca9d" shape={<this.IndicatorDot />} />
                                                {tooltip}
                                                {
                                                    this.state.showSectors && this.state.sectors.map((sector, i) => {
                                                        if (sector["fill"] == "none") return;
                                                        return <ReferenceArea key={`sector-${i}`} x1={sector["x1"]} x2={sector["x2"]} y1={sector["y1"]} y2={sector["y2"]}
                                                            stroke="black" fill={sector["fill"]} strokeOpacity={0.3}
                                                            label={<Label position="insideTop" offset={25}>
                                                                {`#${i + 1} | ${(sector["percentProfit"] * 100).toFixed(2)}%`}
                                                            </Label>
                                                            } alwaysShow />
                                                    })
                                                }
                                            </ScatterChart >
                                        </ResponsiveContainer>
                                    </div>
                                }
                                {
                                    (this.state.indicator2 != "None" && this.state.combinedIndicatorData) && <div className="optimize-chart">
                                        <ResponsiveContainer width="100%" height={`85%`}>
                                            <ScatterChart margin={{ top: 0, right: 40, bottom: 40, left: 20 }} >
                                                <CartesianGrid />
                                                <XAxis type="number" dataKey={this.state.indicator1} name={this.state.indicator1}
                                                    domain={[(dataMin) => this.getDomain(this.state.indicator1)[0], (dataMax) => this.getDomain(this.state.indicator1)[1]]}
                                                    label={{ value: this.state.indicator1, position: "insideBottom", offset: -10 }} tickFormatter={this.xAxisFormatter} />
                                                <YAxis type="number" dataKey={this.state.indicator2} name={this.state.indicator2}
                                                    domain={[(dataMin) => this.getDomain(this.state.indicator2)[0], (dataMax) => this.getDomain(this.state.indicator2)[1]]}
                                                    label={{ value: this.state.indicator2, position: "insideLeft", angle: -90 }} tickFormatter={this.yAxisFormatter} />
                                                <Scatter data={this.state.combinedIndicatorData} fill="#82ca9d" shape={<this.IndicatorDot scale={true} />} />
                                                {tooltip}
                                            </ScatterChart >
                                        </ResponsiveContainer>
                                    </div>
                                }
                            </>
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
        let domain = this.getDomain("percentProfit");
        if (props.percentProfit > 0) {
            let colorValue = mapRange(props.percentProfit, 0, domain[1], 0, 1);
            if (props.scale) dotRadius = colorValue * 10 + 5;
            return <circle cx={cx} cy={cy} r={dotRadius} stroke="black" strokeWidth={0} fill={this.winColormap(colorValue)} />
        }
        else {
            let colorValue = mapRange(props.percentProfit, 0, domain[0], 0, 1);
            if (props.scale) dotRadius = colorValue * 10 + 5;
            return <circle cx={cx} cy={cy} r={dotRadius} stroke="black" strokeWidth={0} fill={this.lossColormap(colorValue)} />
        };
    }
}

let mapStateToProps = (state) => {
    let results = state.backtestResults;
    return { results, id: state.id };
};

export default connect(mapStateToProps, { setBacktestResults })(Optimize);