import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { setBacktestResults } from '../redux/slices/backtestSlice';
import { setLoading } from '../redux/slices/uiSlice';
import { getEndpoint, postEndpoint } from '../helpers/api';
import './Optimize.css';
import { camelToDisplay, mapRange, findOptimalMetric } from '../helpers/utils'
import TextField from '@material-ui/core/TextField';
import {
    Tooltip, Label, ResponsiveContainer, ScatterChart, Scatter, CartesianGrid, XAxis, YAxis, ZAxis, ReferenceArea,
    DotProps
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

import API from '../types/api';
import Backtest from '../types/backtest';

interface AllIndicatorData {
    events: Backtest.OptimizeEventData[],
    stats: { [key: string]: IndicatorStatsEntry },
    percentProfit: { min: number, max: number, mean: number, median: number, standardDeviation: number }
}

interface IndicatorData {
    [key: string]: IndicatorEntry[];
}

interface IndicatorStatsEntry {
    mean: number;
    median: number;
    standardDeviation: number;
}

interface CombinedIndicatorEntry {
    [key: string]: number;
}

interface IndicatorEntry {
    value: number;
    percentProfit: number;
}

interface StatsData {
    percentProfit: number;
}

interface SectorData {
    x1: any;
    x2: any;
    y1: number;
    y2: number;
    events: Backtest.OptimizeEventData[];
    percentProfit: number;
    count: number;
    score: number;
    fill: string;
}

interface StoplossTargetEntry {
    x: string;
    y: string;
    z: string;
    score: number;
    id: string;
    metrics: Backtest.SummaryData;
}

const Optimize = () => {
    const dispatch = useAppDispatch();
    const results = useAppSelector(state => state.backtest.results);
    const id = useAppSelector(state => state.backtest.id);

    // const scoreTypes = ['sharpe', 'weightedReturns', 'equity', 'percentProfit', 'profit'];
    // const modes = ['stoplossTarget', 'indicators'];

    const [mode, setMode] = useState('stoplossTarget');
    const [scoreBy, setScoreBy] = useState('Score');
    const [scoreTypes, setScoreTypes] = useState([]);

    // indicator 
    const [allIndicatorData, setAllIndicatorData] = useState<AllIndicatorData>(null!);
    const [indicatorData, setIndicatorData] = useState<IndicatorData>(null!);
    const [combinedIndicatorData, setCombinedIndicatorData] = useState<CombinedIndicatorEntry[]>([]);
    const [indicatorFields, setIndicatorFields] = useState<string[]>([]);
    const [indicator1, setIndicator1] = useState('');
    const [indicator2, setIndicator2] = useState('None');

    // sectors
    const [numSectors, setNumSectors] = useState(10);
    const [sectorThreshold, setSectorThreshold] = useState(.5);
    const [sectors, setSectors] = useState<SectorData[]>([]);
    const [showSectors, setShowSectors] = useState(true);

    const [loadingStoplossTarget, setLoadingStoplossTarget] = useState(true);
    const [loadingIndicators, setLoadingIndicators] = useState(true);
    const [progress, setProgress] = useState(-1);
    const [baseID, setBaseID] = useState(id);
    const [stoplossTargetOptions, setStoplossTargetOptions] = useState<{ [Property in keyof Backtest.OptimizeOptions]: string }>({
        startStoploss: '0',
        endStoploss: '2',
        strideStoploss: '.5',
        startRatio: '1',
        endRatio: '6',
        strideRatio: '.5'
    })
    const [stoplossTargetData, setStoplossTargetData] = useState<StoplossTargetEntry[]>([]);
    const [optimized, setOptimized] = useState<Backtest.OptimizeStoplossTargetResults>(null!);

    // score from 0 - 1 to interpolate color
    const minSize = 0;
    const maxSize = 1;
    const colormap = interpolate(['#FFCCCB', '#2ecc71']);
    const highlightColormap = interpolate(['red', 'green']);
    const winColormap = interpolate(['#2ecc71', 'green']);
    const lossColormap = interpolate(['#FFCCCB', 'red']);

    useEffect(() => {
        dispatch(setLoading(false));
        fetchResults()
            .then(() => {
                fetchOptimizedStoplossTarget();
                fetchOptimizedIndicators();
            })
    }, [])

    useEffect(() => {
        assignSectors();
    }, [allIndicatorData, indicator1, indicator2, numSectors])

    const fetchResults = () => {
        // fetch results again in case we modified it before
        return new Promise<void>(resolve => {
            getEndpoint<API.Index.GetResults, API.Index._GetResults>('results', { id })
                .then(results => {
                    if ('error' in results) {
                        alert(results['error']);
                        resolve();
                    }
                    else {
                        setBacktestResults({ id, results });
                        resolve();
                    }
                });
        });
    }

    const fetchOptimizedIndicators = () => {
        getEndpoint<API.Index.GetOptimizedIndicators, API.Index._GetOptimizedIndicators>('optimizedIndicators', { id })
            .then(optimized => {
                console.log(optimized);
                // not optimized
                if ('error' in optimized) {
                    setLoadingIndicators(false);
                    return;
                }
                else {
                    let symbols = Object.keys(optimized);
                    let fields = optimized[symbols[0]]['fields'];
                    let allIndicatorData = {
                        events: [],
                        stats: {},
                        percentProfit: { min: 0, max: 0, mean: 0, median: 0, standardDeviation: 0 }
                    } as AllIndicatorData; // contains all events, stats for all fields
                    let combinedIndicatorData: CombinedIndicatorEntry[] = []; // contains all indicator averages
                    let indicatorData: IndicatorData = {}; // maps indicator to averages
                    fields.forEach((field: string) => {
                        indicatorData[field] = []
                    });

                    // transform data for chart
                    symbols.forEach(symbol => {
                        let events = optimized[symbol]['data'];
                        let flattenedData: { [key: string]: number[] } = {};
                        let stats: StatsData = { percentProfit: 0 };
                        let percentProfits: number[] = [];

                        // initialize lists
                        fields.forEach(field => {
                            flattenedData[field] = [];
                        })

                        let faulty = false;
                        // convert data into lists
                        events.forEach((event, i) => {
                            let matchingEvent = results['symbolData'][symbol]['events'][i];
                            // if available, match events by buy date
                            if (event['buyDate']) {
                                let dateMatch = results['symbolData'][symbol]['events'].find(e => e['buyDate'] == event['buyDate']);
                                if (dateMatch) {
                                    matchingEvent = dateMatch;
                                }
                            }
                            if (!matchingEvent) {
                                faulty = true;
                                return;
                            }

                            // track symbol and buyDate to match later on
                            event['symbol'] = symbol;
                            event['buyDate'] = matchingEvent['buyDate'];
                            allIndicatorData['events'].push(event);
                            percentProfits.push(event['percentProfit']);
                            // record for each indicator field
                            event['indicators'].forEach((v, i) => {
                                if (!v) faulty = true;
                                flattenedData[fields[i]].push(v);
                            })
                        })
                        if (faulty) return;

                        // average out events for each symbol to create a point on the scatter chart                     
                        stats['percentProfit'] = mean(percentProfits);
                        let combinedIndicatorEntry: CombinedIndicatorEntry = { percentProfit: stats['percentProfit'] };
                        Object.keys(flattenedData).forEach(indicatorField => {
                            let indicatorEntry: IndicatorEntry = {
                                value: mean(flattenedData[indicatorField]),
                                percentProfit: stats['percentProfit']
                            };
                            indicatorData[indicatorField].push(indicatorEntry);
                            combinedIndicatorEntry[indicatorField] = indicatorEntry['value'];
                        })
                        combinedIndicatorData.push(combinedIndicatorEntry);
                    });

                    // calculate stats for all data
                    fields.forEach((field, fieldIndex) => {
                        let flattened: number[] = [];
                        allIndicatorData['events'].forEach(event => {
                            if (event['indicators'][fieldIndex]) {
                                flattened.push(event['indicators'][fieldIndex]);
                            }
                        });
                        allIndicatorData['stats'][field] = {
                            mean: mean(flattened),
                            median: median(flattened),
                            standardDeviation: standardDeviation(flattened)
                        }
                    })
                    // calculate percent profits
                    let flattened: number[] = [];
                    allIndicatorData['events'].forEach(event => {
                        flattened.push(event['percentProfit']);
                    });
                    allIndicatorData['percentProfit'] = {
                        min: min(flattened),
                        max: max(flattened),
                        mean: mean(flattened),
                        median: median(flattened),
                        standardDeviation: standardDeviation(flattened)
                    };

                    setAllIndicatorData(allIndicatorData);
                    setIndicatorData(indicatorData);
                    setCombinedIndicatorData(combinedIndicatorData);
                    setIndicatorFields(fields);
                    setIndicator1(fields[0]);
                    setLoadingIndicators(false);

                    console.log(indicatorData, allIndicatorData, combinedIndicatorData)
                }
            });
    }

    const fetchOptimizedStoplossTarget = () => {
        return new Promise<void>((resolve) => {
            // check if already optimized
            getEndpoint<API.Index.GetOptimizedStoplossTarget, API.Index._GetOptimizedStoplossTarget>('optimizedStoplossTarget', { id })
                .then(optimized => {
                    console.log(optimized)
                    // not optimized
                    if ('error' in optimized) {
                        setLoadingStoplossTarget(false);
                        resolve();
                        return;
                    }

                    let baseID = optimized['id'];
                    let results = optimized['results'];
                    let optimizedIDs = Object.keys(results);
                    // transform data for chart
                    let metrics = optimizedIDs.map(optimizedID => results[optimizedID]['summary']);
                    let { scores } = findOptimalMetric(metrics);
                    let minScore = Math.min(...scores);
                    let maxScore = Math.max(...scores);

                    let stoplossTargetData: StoplossTargetEntry[] = [];
                    optimizedIDs.forEach((id, i) => {
                        let strategyOptions = results[id]['strategyOptions'];
                        let score = mapRange(scores[i], minScore, maxScore, minSize, maxSize);
                        stoplossTargetData.push({
                            x: strategyOptions['stopLossAtr']!.toFixed(2),
                            y: strategyOptions['riskRewardRatio']!.toFixed(2),
                            z: score.toFixed(2),
                            score: score ? score : 0,
                            id: id,
                            metrics: metrics[i]
                        });
                    })
                    setBaseID(baseID);
                    setLoadingStoplossTarget(false);
                    setStoplossTargetData(stoplossTargetData);
                    setOptimized(results);

                    resolve();
                });
        })
    }

    const requestStoplossTargetOptimization = () => {
        let optimizeOptions = {
            startStoploss: 0,
            endStoploss: 0,
            strideStoploss: 0,
            startRatio: 0,
            endRatio: 0,
            strideRatio: 0
        } as Backtest.OptimizeOptions;
        // error check
        let error = '';
        (Object.keys(stoplossTargetOptions) as (keyof Backtest.OptimizeOptions)[]).forEach(f => {
            optimizeOptions[f] = parseFloat(stoplossTargetOptions[f]);
            if (optimizeOptions[f] == undefined) {
                error = 'Invalid field. Must be numbers.';
            }
        });
        if (optimizeOptions['startStoploss'] >= optimizeOptions['endStoploss'] || optimizeOptions['startRatio'] >= optimizeOptions['endRatio']) {
            error = 'End must be greater than Start.';
        }
        if (optimizeOptions['strideStoploss'] <= 0 || optimizeOptions['strideRatio'] <= 0) {
            error = 'Stride must be greater than 0.';
        }
        if (error) {
            alert(error);
            return;
        }

        // valid request
        postEndpoint<API.Index.PostOptimizeStoplossTarget, API.Index._PostOptimizeStoplossTarget>('optimizeStoplossTarget', {
            id, ...optimizeOptions
        })
            .then(json => {
                if ('error' in json) {
                    alert(json['error']);
                }
                else {
                    setBaseID(json['id'])
                    alert(json['status']);
                }
            });
    }

    const requestIndicatorOptimization = () => {
        postEndpoint<API.Index.PostOptimizeIndicators, API.Index._PostOptimizeIndicators>('optimizeIndicators', { id })
            .then(json => {
                if ('error' in json) {
                    alert(json['error']);
                }
                else {
                    setBaseID(json['id'])
                    alert(json['status']);
                }
            });
    }

    const assignSectors = () => {
        if (!indicator1) return;
        let fieldIndex = indicatorFields.indexOf(indicator1);
        let sectors: SectorData[] = [];
        let domain = getDomain(indicator1);
        let range = domain[1] - domain[0];
        let sectorSize = range / numSectors;
        let minPercentProfit = 100;
        let maxPercentProfit = -100;
        // split up each sector and calculate their profits
        for (let i = 0; i < numSectors; ++i) {
            let sector = {
                x1: domain[0] + sectorSize * i,
                x2: domain[0] + sectorSize * (i + 1),
                y1: allIndicatorData['percentProfit']['min'],
                y2: allIndicatorData['percentProfit']['max'],
                events: [] as Backtest.OptimizeEventData[],
                percentProfit: 0,
                count: 0,
                score: 0,
                fill: ''
            };
            let percentProfit = 0;
            let count = 0;
            allIndicatorData['events'].forEach(event => {
                let v = event['indicators'][fieldIndex];
                // within sector
                if (v >= sector['x1'] && v < sector['x2']) {
                    sector['events'].push(event);
                    percentProfit += event['percentProfit'];
                    count += 1;
                }
            })
            sector['percentProfit'] = percentProfit / count;
            sector['count'] = count;
            if (sector['percentProfit'] < minPercentProfit) minPercentProfit = sector['percentProfit'];
            if (sector['percentProfit'] > maxPercentProfit) maxPercentProfit = sector['percentProfit'];
            sectors.push(sector);
        }

        // score each sector relative to each other to assign color
        sectors.forEach(sector => {
            let score = mapRange(sector['percentProfit'], 0, maxPercentProfit, 0, 1);
            let fill = ''
            if (score) {
                fill = highlightColormap(score);
            }
            else {
                // no data
                fill = 'none';
            }
            sector['score'] = score;
            if (sector['percentProfit'] > 0) {
                // score = mapRange(sector['percentProfit'], 0, maxPercentProfit, 0, 1);
                // fill = winColormap(score);
                sector['fill'] = fill;
            }
            else {
                // let score = mapRange(sector['percentProfit'], 0, minPercentProfit, 0, 1);
                // fill = lossColormap(score);
                sector['fill'] = fill;
            }
        });
        sectors.sort((a, b) => b['score'] - a['score']);
        setSectors(sectors);
    }

    const applySectors = () => {
        let top = Math.floor(numSectors * sectorThreshold);
        let newResults = JSON.parse(JSON.stringify(results)) as Backtest.ResultsData;
        for (let i = 0; i < top; ++i) {
            let sector = sectors[i];
            // tag events to be removed
            sector['events'].forEach(event => {
                let actualEvents = newResults['symbolData'][event['symbol']!]['events'];
                for (let eventIndex = 0; eventIndex < actualEvents.length; ++eventIndex) {
                    let e = actualEvents[eventIndex];
                    // keep event if buy date matches
                    if (e['buyDate'] == event['buyDate']) {
                        e['keep'] = true;
                    }
                }
            })
        }

        // does the actual removal
        let filtered = 0;
        Object.keys(newResults['symbolData']).forEach(symbol => {
            let newEvents = newResults['symbolData'][symbol]['events'].filter(event => event['keep']);
            // remove the tag
            newEvents.forEach(e => delete e['keep']);
            newResults['symbolData'][symbol]['events'] = newEvents;
            filtered += newEvents.length;
        })

        // update redux
        dispatch(setBacktestResults({ id, results: newResults }));
        alert('Kept ' + filtered + ' events');
    }

    const switchMode = () => {
        if (mode == 'stoplossTarget') {
            setMode('indicators');
        }
        else {
            setMode('stoplossTarget');
        }
    }

    const getDomain = (field: string) => {
        let mean = 0;
        let standardDeviation = 0;
        if (field == 'percentProfit') {
            mean = allIndicatorData['percentProfit']['mean'];
            standardDeviation = allIndicatorData['percentProfit']['standardDeviation'];
        }
        else {
            mean = allIndicatorData['stats'][field]['mean'];
            standardDeviation = allIndicatorData['stats'][field]['standardDeviation'];
        }
        let deviations = 2;
        let domain = [mean - deviations * standardDeviation, mean + deviations * standardDeviation];
        let onlyPositive = ['Head_Ratio', 'Leg_Ratio'];
        if (onlyPositive.includes(field)) {
            domain[0] = Math.max(0, domain[0]);
        }
        return domain;
    }

    const yAxisFormatter = (value: number) => {
        return value.toFixed(2);
    }

    const xAxisFormatter = (value: number) => {
        return value.toFixed(2);
    }

    const tooltipFormatter = (value: number, name: string, props: { payload: StoplossTargetEntry }) => {
        if (name == 'Score') {
            let metricNames = Object.keys(props['payload']['metrics']) as ((keyof Backtest.SummaryData)[]);
            return [<>
                {value}<br />
                {metricNames.map(metricName => <>
                    {camelToDisplay(metricName)}: {props['payload']['metrics'][metricName].toFixed(2)}<br />
                </>)}
            </>, name]
        }
        if (value) {
            try {
                return value.toFixed(4);
            }
            catch {
                if (typeof value == 'object') {
                    return JSON.stringify(value);
                }
                return value;
            }
        }
    }

    interface CustomizedDotData extends DotProps {
        score?: number;
    }

    const CustomizedDot: React.FC<CustomizedDotData> = (props) => {
        const {
            cx, cy
        } = props;

        // StoplossTargetEntry

        if (props.score) {
            let dotRadius = props.score * 10 + 5;
            if (props.score == maxSize) {
                return <rect x={cx! - dotRadius} y={cy! - dotRadius} width={dotRadius * 2} height={dotRadius * 2} stroke='black' strokeWidth={0} fill={colormap(props.score)} />;
            }
            return (
                <circle cx={cx} cy={cy} r={dotRadius} stroke='black' strokeWidth={0} fill={colormap(props.score)} />
            );
        }
        return <></>
    }

    interface IndicatorDotData extends DotProps {
        percentProfit?: number;
    }

    const IndicatorDot: React.FC<IndicatorDotData> = (props) => {
        const {
            cx, cy
        } = props;

        if (props.percentProfit) {
            let dotRadius = 10;
            let domain = getDomain('percentProfit');
            if (props.percentProfit > 0) {
                let colorValue = mapRange(props.percentProfit, 0, domain[1], 0, 1);
                if (props.scale) dotRadius = colorValue * 10 + 5;
                return <circle cx={cx} cy={cy} r={dotRadius} stroke='black' strokeWidth={0} fill={winColormap(colorValue)} />
            }
            else {
                let colorValue = mapRange(props.percentProfit, 0, domain[0], 0, 1);
                if (props.scale) dotRadius = colorValue * 10 + 5;
                return <circle cx={cx} cy={cy} r={dotRadius} stroke='black' strokeWidth={0} fill={lossColormap(colorValue)} />
            };
        }
        return <></>
    }

    let tooltip = <Tooltip formatter={tooltipFormatter} />

    return <div className='optimize'>
        <Pusher
            channel={baseID}
            event='onOptimizeProgressUpdate'
            onUpdate={(data: API.Pusher.OnOptimizeProgressUpdate) => { if (mode == 'stoplossTarget') setProgress(data['progress']) }}
        />
        <Pusher
            channel={baseID}
            event='onOptimizeIndicatorsProgressUpdate'
            onUpdate={(data: API.Pusher.OnOptimizeIndicatorsProgressUpdate) => { if (mode == 'indicators') setProgress(data['progress']) }}
        />
        <Pusher
            channel={baseID}
            event='onOptimizeFinished'
            onUpdate={(data: API.Pusher.OnOptimizeFinished) => {
                fetchOptimizedStoplossTarget();
                setProgress(-1);
            }}
        />
        <Pusher
            channel={baseID}
            event='onOptimizeIndicatorsFinished'
            onUpdate={(data: API.Pusher.OnOptimizeIndicatorsFinished) => {
                fetchOptimizedIndicators();
                setProgress(-1);
            }}
        />
        <div className='optimize-header'>
            <h3 className='optimize-title'>Optimize {camelToDisplay(mode)}</h3>
            {
                progress != -1 && (
                    <LinearProgress className='optimize-progress' variant='determinate' value={progress} />
                )
            }
        </div>
        <div className='optimize-body'>
            <IconButton
                aria-label='more'
                aria-controls='long-menu'
                aria-haspopup='true'
                onClick={switchMode}
                className='optimize-mode'
                style={{ position: 'absolute' }}
            >
                <NavigateNextIcon />
            </IconButton>
            {
                mode == 'stoplossTarget' && <>
                    <div className='optimize-card'>
                        {
                            Object.keys(stoplossTargetOptions).map(field => <TextField className='optimize-field' key={`optimize-${field}`}
                                label={camelToDisplay(field)} value={stoplossTargetOptions[field as keyof Backtest.OptimizeOptions]}
                                onChange={(e) => {
                                    setStoplossTargetOptions({
                                        ...stoplossTargetOptions,
                                        [field]: e.target.value
                                    })
                                }} />)
                        }
                        <Box ml='1vw' >
                            <Button variant='contained' color='primary' onClick={requestStoplossTargetOptimization}>
                                Optimize
                            </Button>
                        </Box>
                    </div>
                    {
                        loadingStoplossTarget && <div className='optimize-loading'>
                            <h1>Fetching Optimized Results...</h1>
                            <CircularProgress />
                        </div>
                    }
                    {
                        optimized && <div className='optimize-chart'>
                            <ResponsiveContainer width='100%' height={`85%`}>
                                <ScatterChart margin={{ top: 0, right: 40, bottom: 40, left: 20 }} >
                                    <CartesianGrid />
                                    <XAxis type='number' dataKey='x' name='Stoploss' domain={[0, 'dataMax']} label={{ value: 'Stoploss', position: 'insideBottom', offset: -10 }} tickFormatter={xAxisFormatter} />
                                    <YAxis type='number' dataKey='y' name='Risk Reward Ratio' domain={[0, 'dataMax']} label={{ value: 'Risk Reward Ratio', position: 'insideLeft', angle: -90 }} tickFormatter={yAxisFormatter} />
                                    <ZAxis dataKey='z' name='Score' />
                                    <Scatter data={stoplossTargetData} fill='#82ca9d' shape={<CustomizedDot />} onClick={(params) => {
                                        let url = (process.env.NODE_ENV == 'production' ? (process.env.REACT_APP_DOMAIN! + process.env.REACT_APP_SUBDIRECTORY!) : 'localhost:3000') + '/' + params['id'];
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
                mode == 'indicators' && <>
                    {
                        !indicatorData && <>
                            <div className='optimize-card' style={{ justifyContent: 'center' }}>
                                <Box ml='1vw' >
                                    <Button variant='contained' color='primary' onClick={requestIndicatorOptimization}>
                                        Optimize
                                    </Button>
                                </Box>
                            </div>
                        </>
                    }
                    {
                        loadingIndicators && <div className='optimize-loading'>
                            <h1>Fetching Indicator Data...</h1>
                            <CircularProgress />
                        </div>
                    }
                    {
                        (indicatorData && indicator1) && <><div className='optimize-card'>
                            <Box ml='1vw'>
                                <FormControl style={{ minWidth: '5vw' }}>
                                    <InputLabel>Indicator 1</InputLabel>
                                    <Select
                                        value={indicator1}
                                        onChange={(e) => setIndicator1(e.target.value as string)}
                                    >
                                        {
                                            indicatorFields.map((indicatorField, index) => {
                                                return <MenuItem key={`optimize-indicator1-field-${index}`} value={indicatorField}>{indicatorField}</MenuItem>
                                            })
                                        }
                                    </Select>
                                </FormControl>
                            </Box>
                            <Box ml='1vw'>
                                <FormControl style={{ minWidth: '5vw' }}>
                                    <InputLabel>Indicator 2</InputLabel>
                                    <Select
                                        value={indicator2}
                                        onChange={(e) => setIndicator2(e.target.value as string)}
                                    >
                                        <MenuItem key={`optimize-indicator1-field-none`} value={'None'}>None</MenuItem>
                                        {
                                            indicatorFields.map((indicatorField, index) => {
                                                return <MenuItem key={`optimize-indicator1-field-${index}`} value={indicatorField}>{indicatorField}</MenuItem>
                                            })
                                        }
                                    </Select>
                                </FormControl>
                            </Box>
                            <Box mx='1vw' mt='1vh'>
                                <FormControl style={{ minWidth: '5vw' }}>
                                    <InputLabel># Sectors</InputLabel>
                                    <Slider
                                        defaultValue={50}
                                        aria-labelledby='discrete-slider'
                                        valueLabelDisplay='auto'
                                        value={numSectors}
                                        onChange={(e, v) => setNumSectors(v as number)}
                                        step={1}
                                        marks
                                        min={1}
                                        max={20}
                                    />
                                </FormControl>
                            </Box>
                            <Box mx='1vw' mt='1vh'>
                                <FormControl style={{ minWidth: '5vw' }}>
                                    <InputLabel>Apply Sectors</InputLabel>
                                    <Slider
                                        defaultValue={.5}
                                        aria-labelledby='discrete-slider'
                                        valueLabelDisplay='auto'
                                        value={sectorThreshold}
                                        onChange={(e, v) => setSectorThreshold(v as number)}
                                        step={.1}
                                        marks
                                        min={0}
                                        max={1}
                                    />
                                </FormControl>
                            </Box>
                            <Box mx='1vw' mt='1vh'>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={showSectors}
                                            onChange={(e) => setShowSectors(e.target.checked)}
                                            color='primary'
                                        />
                                    }
                                    label='Show Sectors'
                                />
                            </Box>
                            <Box ml='1vw' >
                                <Button variant='contained' color='primary' onClick={applySectors}>
                                    Apply
                                </Button>
                            </Box>
                        </div>
                            {
                                indicator2 == 'None' && <div className='optimize-chart'>
                                    <ResponsiveContainer width='100%' height={`85%`}>
                                        <ScatterChart margin={{ top: 0, right: 40, bottom: 40, left: 20 }} >
                                            <CartesianGrid />
                                            <XAxis type='number' dataKey='value' name={indicator1}
                                                domain={[() => getDomain(indicator1)[0], () => getDomain(indicator1)[1]]}
                                                label={{ value: indicator1, position: 'insideBottom', offset: -10 }} tickFormatter={xAxisFormatter}
                                                ticks={sectors.map(sector => sector['x1'])} interval={0} />
                                            <YAxis type='number' dataKey='percentProfit' name='Percent Profit' domain={['dataMin', 'dataMax']}
                                                label={{ value: 'Percent Profit', position: 'insideLeft', angle: -90 }} tickFormatter={yAxisFormatter} />
                                            <Scatter data={indicatorData[indicator1]} fill='#82ca9d' shape={<IndicatorDot />} />
                                            {tooltip}
                                            {
                                                showSectors && sectors.map((sector, i) => {
                                                    if (sector['fill'] == 'none') return;
                                                    return <ReferenceArea key={`sector-${i}`} x1={sector['x1']} x2={sector['x2']} y1={sector['y1']} y2={sector['y2']}
                                                        stroke='black' fill={sector['fill']} strokeOpacity={0.3}
                                                        label={<Label position='insideTop' offset={25}>
                                                            {`#${i + 1} | ${(sector['percentProfit'] * 100).toFixed(2)}%`}
                                                        </Label>
                                                        } alwaysShow />
                                                })
                                            }
                                        </ScatterChart >
                                    </ResponsiveContainer>
                                </div>
                            }
                            {
                                (indicator2 != 'None' && combinedIndicatorData) && <div className='optimize-chart'>
                                    <ResponsiveContainer width='100%' height={`85%`}>
                                        <ScatterChart margin={{ top: 0, right: 40, bottom: 40, left: 20 }} >
                                            <CartesianGrid />
                                            <XAxis type='number' dataKey={indicator1} name={indicator1}
                                                domain={[() => getDomain(indicator1)[0], () => getDomain(indicator1)[1]]}
                                                label={{ value: indicator1, position: 'insideBottom', offset: -10 }} tickFormatter={xAxisFormatter} />
                                            <YAxis type='number' dataKey={indicator2} name={indicator2}
                                                domain={[() => getDomain(indicator2)[0], () => getDomain(indicator2)[1]]}
                                                label={{ value: indicator2, position: 'insideLeft', angle: -90 }} tickFormatter={yAxisFormatter} />
                                            <Scatter data={combinedIndicatorData} fill='#82ca9d' shape={<IndicatorDot scale={1} />} />
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

export default Optimize;