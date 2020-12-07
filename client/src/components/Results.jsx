import React, { createRef } from 'react';
import { connect } from 'react-redux';
import { viewStock, setBacktestResults, setChartSettings } from '../redux';
import './Results.css';
import 'react-tabs/style/react-tabs.css';
import eye from "../eye.svg";
import buy from "../buy.svg";
import bought from "../bought.svg";
import sell from "../sell.svg";
import { formatDate, daysBetween } from "../helpers/utils";
import Pusher from 'react-pusher';

import TextField from '@material-ui/core/TextField';
import InputAdornment from '@material-ui/core/InputAdornment';
import SearchOutlinedIcon from '@material-ui/icons/SearchOutlined';
import Slider from '@material-ui/core/Slider';
import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Switch from '@material-ui/core/Switch';
import IconButton from '@material-ui/core/IconButton';
import SettingsIcon from '@material-ui/icons/Settings';
import ImportExportIcon from '@material-ui/icons/ImportExport';

class Results extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            numWins: 0, numLosses: 0, winSpan: 0, lossSpan: 0, winProfit: 0, lossProfit: 0, winPercentProfit: 0, lossPercentProfit: 0,
            sortedSymbols: [], recentThreshold: 7, boughtSymbols: {}, search: "", updateProgress: -1, tabIndex: 0,
            chartSettings: {}, ready: false
        }
        this.supportedExports = ["StocksTracker", "Finviz"];
    }

    // when clicking on an item
    handleGetResult = (symbol) => {
        this.props.viewStock(symbol)
    }

    // statistical analysis (win/loss)
    analyze() {
        let sortBy = "percentProfit";
        // get the sorted symbols
        let sortedSymbols = Object.keys(this.props.results["symbolData"]);
        sortedSymbols.sort((a, b) => this.props.results["symbolData"][b][sortBy] - this.props.results["symbolData"][a][sortBy]);
        this.setState({ sortedSymbols });

        let symbols = Object.keys(this.props.results["symbolData"]);
        symbols.forEach(symbol => {
            let score = 0;
            let localityWeight = .8;
            this.props.results["symbolData"][symbol]["events"].forEach(event => {
                let newScore = event["percentProfit"] > 0 ? 1 : 0;
                score = (newScore * localityWeight + score * (1 - localityWeight)) / 2;
            });
            this.props.results["symbolData"][symbol]["score"] = score;
        });
        this.setState({ ready: true });
    }

    componentDidMount() {
        this.analyze();
        this.getBoughtSymbols();
    }

    componentDidUpdate(prevProps) {
        if (prevProps.id != this.props.id) {
            this.analyze();
            this.getBoughtSymbols();
        }
    }

    // load initial bought list
    getBoughtSymbols = () => {
        fetch(`${process.env.NODE_ENV == "production" ? process.env.REACT_APP_SUBDIRECTORY : ""}/boughtSymbols`)
            .then(res => res.json())
            .then(boughtSymbols => {
                this.setState({ boughtSymbols });
            })
    }

    // mark as bought
    buySymbol = (symbol) => {
        fetch(`${process.env.NODE_ENV == "production" ? process.env.REACT_APP_SUBDIRECTORY : ""}/buySymbol?symbol=${symbol}`)
            .then(res => res.json())
            .then(boughtSymbols => {
                this.setState({ boughtSymbols });
            })
    }

    // sell
    sellSymbol = (symbol) => {
        fetch(`${process.env.NODE_ENV == "production" ? process.env.REACT_APP_SUBDIRECTORY : ""}/sellSymbol?symbol=${symbol}`)
            .then(res => res.json())
            .then(boughtSymbols => {
                this.setState({ boughtSymbols });
            })
    }

    setTab = (event, newValue) => {
        this.setState({ tabIndex: newValue })
    };

    onSettingChanged = (setting, state) => {
        this.setState({ chartSettings: { ...this.state.chartSettings, [setting]: state } },
            () => {
                this.props.setChartSettings(this.state.chartSettings);
            });
    }

    // export buys
    onExportClicked = (destination) => {
        // store passwords locally
        if (!localStorage.getItem("exportInfo")) {
            localStorage.setItem("exportInfo", `{}`)
        }

        // get login if not stored
        let login = JSON.parse(localStorage.getItem("exportInfo"));
        if (!login[destination]) {
            login[destination] = {};
        }
        if (!login[destination]["username"]) {
            login[destination]["username"] = prompt(`Enter your ${destination} username.`);
        }
        if (!login[destination]["password"]) {
            login[destination]["password"] = prompt(`Enter your ${destination} password.`);
        }
        // store info back into local storage
        localStorage.setItem("exportInfo", JSON.stringify(login));
        // if cancel
        if (!login[destination]["username"] || !login[destination]["password"]) {
            return;
        }

        // get watchist
        let watchlist = prompt("Enter the watchlist name.");
        if (!watchlist) {
            return;
        }

        // get symbols to export
        let lastRecentDate = new Date()
        lastRecentDate.setDate(lastRecentDate.getDate() - this.state.recentThreshold);
        let symbolsToExport = [];
        this.state.sortedSymbols.filter(symbol => {
            let count = this.props.results["symbolData"][symbol]["holdings"].filter(d => daysBetween(lastRecentDate, new Date(d)) < 1).length;
            if (count) {
                symbolsToExport.push(symbol);
            }
        })

        // make automation api request
        let data = { destination, symbols: symbolsToExport, login: login[destination], watchlist };
        fetch(`${process.env.NODE_ENV == "production" ? process.env.REACT_APP_SUBDIRECTORY : ""}/users/watchlist`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            })
            .then(res => res.json())
            .then(json => alert(json["status"]));
    }

    render() {
        if (!this.state.ready) {
            return <></>;
        }

        let lastRecentDate = new Date()
        lastRecentDate.setDate(lastRecentDate.getDate() - this.state.recentThreshold);

        let search = this.state.search.toLowerCase().trim();
        let searchResults = this.state.sortedSymbols.filter(s => s.toLowerCase().startsWith(search));
        let searchBar = <input className="results-search" value={this.state.search} onChange={e => { this.setState({ search: e.target.value }) }} />;
        let dayFilter = <input className="results-search" value={this.state.recentThreshold} type="number" onChange={e => { this.setState({ recentThreshold: parseFloat(e.target.value) }) }}></input>

        searchBar = <Box mb="1vh"><TextField
            id="input-with-icon-textfield"
            value={this.state.search}
            onChange={e => { this.setState({ search: e.target.value }) }}
            InputProps={{
                startAdornment: (
                    <InputAdornment position="start">
                        <SearchOutlinedIcon />
                    </InputAdornment>
                ),
            }}
        /></Box>

        dayFilter = <div>
            <p className="results-dayfilter">
                Show events {this.state.recentThreshold} days ago
            </p>
            <Box mx="1vw" mt="1vh"><Slider
                defaultValue={7}
                aria-labelledby="discrete-slider"
                valueLabelDisplay="auto"
                value={this.state.recentThreshold}
                onChange={(e, v) => { this.setState({ recentThreshold: v }) }}
                step={1}
                marks
                min={1}
                max={30}
            /></Box>
        </div>

        let buySymbols = [];
        for (let i = 0; i < this.state.sortedSymbols.length; ++i) {
            let symbol = this.state.sortedSymbols[i];
            if (this.props.results["symbolData"][symbol]["holdings"].find(d => daysBetween(lastRecentDate, new Date(d)) == 0)) {
                buySymbols.push({ symbol: symbol, index: i });
            }
        }
        buySymbols.sort((a, b) => this.props.results["symbolData"][b["symbol"]]["score"] - this.props.results["symbolData"][a["symbol"]]["score"]);

        let tabPanelStyle = { overflow: "auto" };

        return (
            <div className="results">
                <h2 className="results-title">
                    Results {<SettingsMenu items={["Candles", "Support Lines", "Test Mode"]} options={this.state.chartSettings} onChange={this.onSettingChanged} />}
                </h2>
                <div>{searchBar}</div>
                {/* <Paper square> */}
                <Tabs value={this.state.tabIndex} onChange={this.setTab} indicatorColor="primary" centered aria-label="simple tabs example">
                    <Tab style={{ minWidth: "3vw" }} label="All" {...a11yProps(0)} />
                    <Tab style={{ minWidth: "3vw" }} label="Buys" {...a11yProps(1)} />
                    <Tab style={{ minWidth: "3vw" }} label="Sells" {...a11yProps(2)} />
                    <Tab style={{ minWidth: "3vw" }} label="Watch" {...a11yProps(3)} />
                </Tabs>
                {/* </Paper> */}
                <TabPanel value={this.state.tabIndex} index={0} style={tabPanelStyle}>
                    <div className="results-list">
                        {this.state.sortedSymbols.length == 0 && (<span>
                            There are no results...
                        </span>)
                        }
                        {this.state.sortedSymbols.length != 0 && (
                            <>
                                {
                                    this.state.sortedSymbols.map((symbol, index) => {
                                        if (searchResults.includes(symbol)) {
                                            return <Result buy key={index} symbol={symbol} index={index} result={this.props.results["symbolData"][symbol]}
                                                handleGetResult={this.handleGetResult} buySymbol={this.buySymbol} sellSymbol={this.sellSymbol}
                                                boughtSymbols={this.state.boughtSymbols} />
                                        }
                                    })
                                }
                            </>
                        )
                        }
                    </div>
                </TabPanel>
                <TabPanel value={this.state.tabIndex} index={1} style={tabPanelStyle}>
                    <div className="results-list">
                        {this.state.sortedSymbols.length == 0 && (<span>
                            There are no results...
                        </span>)
                        }
                        {this.state.sortedSymbols.length != 0 && (
                            <>
                                <ExportMenu items={this.supportedExports} onClick={this.onExportClicked} />
                                {dayFilter}
                                {this.state.sortedSymbols.length != 0 && (
                                    buySymbols.map(({ symbol, index }) =>
                                        <Result sell key={index} symbol={symbol} index={index} result={this.props.results["symbolData"][symbol]}
                                            handleGetResult={this.handleGetResult} buySymbol={this.buySymbol} sellSymbol={this.sellSymbol}
                                            boughtSymbols={this.state.boughtSymbols} />)
                                )
                                }
                            </>
                        )
                        }
                    </div>
                </TabPanel>
                <TabPanel value={this.state.tabIndex} index={2} style={tabPanelStyle}>
                    <div className="results-list">
                        {this.state.sortedSymbols.length == 0 && (<span>
                            There are no results...
                        </span>)
                        }
                        <>
                            {dayFilter}
                            {this.state.sortedSymbols.length != 0 && (
                                this.state.sortedSymbols.map((symbol, index) => {
                                    // only show if there are recent events
                                    let events = this.props.results["symbolData"][symbol]["events"];
                                    let numEvents = events.filter(e => daysBetween(lastRecentDate, new Date(e["sellDate"])) == 0).length;
                                    if (numEvents > 0) {
                                        if (searchResults.includes(symbol)) {
                                            return <Result sell key={index} symbol={symbol} index={index} result={this.props.results["symbolData"][symbol]}
                                                handleGetResult={this.handleGetResult} buySymbol={this.buySymbol} sellSymbol={this.sellSymbol}
                                                boughtSymbols={this.state.boughtSymbols} />
                                        }
                                    }
                                })
                            )
                            }
                        </>
                    </div>
                </TabPanel>
                <TabPanel value={this.state.tabIndex} index={3} style={tabPanelStyle}>
                    <div className="results-list">
                        {this.state.sortedSymbols.length == 0 && (<span>
                            There are no results...
                        </span>)
                        }
                        <>
                            {this.state.sortedSymbols.length != 0 && (
                                this.state.sortedSymbols.map((symbol, index) => {
                                    if (this.state.boughtSymbols.hasOwnProperty(symbol)) {
                                        return <Result sell key={index} symbol={symbol} index={index} result={this.props.results["symbolData"][symbol]}
                                            handleGetResult={this.handleGetResult} buySymbol={this.buySymbol} sellSymbol={this.sellSymbol}
                                            boughtSymbols={this.state.boughtSymbols} />
                                    }
                                })
                            )
                            }
                        </>
                    </div>
                </TabPanel>
            </div>
        );
    }
}

class Result extends React.Component {
    state = { hovered: false }

    buySymbol = () => {
        this.props.buySymbol(this.props.symbol);
    }

    sellSymbol = () => {
        this.props.sellSymbol(this.props.symbol);
    }

    render() {
        return (<div className="result" onMouseEnter={() => this.setState({ hovered: true })} onMouseLeave={() => this.setState({ hovered: false })}>
            <img className={`result-icon result-hover`} width="25px" height="25px" src={eye} alt="Eye" onClick={() => this.props.handleGetResult(this.props.symbol)} />
            <span className="result-text" style={{ color: `${this.props.result["percentProfit"] > 0 ? "green" : "red"}` }} onClick={() => this.props.handleGetResult(this.props.symbol)} >{
                `${this.props.index + 1}. ${this.props.symbol}`}
            </span>
            {
                this.props.buy && !this.props.boughtSymbols.hasOwnProperty(this.props.symbol) && (
                    <img className={`result-trailer ${this.state.hovered ? "result-hover" : ""}`} width="35px" height="35px" src={buy} alt="Buy"
                        onClick={this.buySymbol} />)
            }
            {
                this.props.buy && this.props.boughtSymbols.hasOwnProperty(this.props.symbol) && (
                    <img className={`result-trailer result-hover`} width="35px" height="35px" src={bought} alt="Bought"
                        onClick={this.sellSymbol} />)
            }
            {
                this.props.sell && !this.props.boughtSymbols.hasOwnProperty(this.props.symbol) && (
                    <img className={`result-trailer ${this.state.hovered ? "result-hover" : ""}`} width="35px" height="35px" src={buy} alt="Buy"
                        onClick={this.buySymbol} />)
            }
            {
                this.props.sell && this.props.boughtSymbols.hasOwnProperty(this.props.symbol) && (
                    <img className={`result-trailer result-hover`} width="35px" height="35px" src={sell} alt="Sell"
                        onClick={this.sellSymbol} />)
            }

        </div>);
    }
}

function a11yProps(index) {
    return {
        id: `simple-tab-${index}`,
        'aria-controls': `simple-tabpanel-${index}`,
    };
}

function TabPanel(props) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`simple-tabpanel-${index}`}
            aria-labelledby={`simple-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box>
                    <Typography>{children}</Typography>
                </Box>
            )}
        </div>
    );
}

function SettingsMenu(props) {
    const [anchorEl, setAnchorEl] = React.useState(null);

    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    return (
        <>
            <IconButton
                aria-label="more"
                aria-controls="long-menu"
                aria-haspopup="true"
                onClick={handleClick}
                style={{ position: "absolute", top: 0, right: 0 }}
            >
                <SettingsIcon />
            </IconButton>
            <Menu
                id="settings-menu"
                anchorEl={anchorEl}
                keepMounted
                open={Boolean(anchorEl)}
                onClose={handleClose}
            >
                {
                    props.items.map((item, index) => {
                        return <MenuItem key={`results-settings-${index}`}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={props.options[item] ? true : false}
                                        onChange={(e) => { props.onChange(item, e.target.checked) }}
                                        color="primary"
                                    />
                                }
                                label={`${item}`}
                            />
                        </MenuItem>
                    })
                }
            </Menu>
        </>
    );
}

function ExportMenu(props) {
    const [anchorEl, setAnchorEl] = React.useState(null);

    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    return (
        <>
            <IconButton
                aria-label="more"
                aria-controls="long-menu"
                aria-haspopup="true"
                onClick={handleClick}
                style={{ position: "absolute", top: 0, right: 0 }}
                color="primary"
            >
                <ImportExportIcon />
            </IconButton>
            <Menu
                id="export-menu"
                anchorEl={anchorEl}
                keepMounted
                open={Boolean(anchorEl)}
                onClose={handleClose}
            >
                {
                    props.items.map((item, index) => {
                        return <MenuItem key={`results-export-${index}`} onClick={() => { props.onClick(item) }}>
                            {item}
                        </MenuItem>
                    })
                }
            </Menu>
        </>
    );
}

let mapStateToProps = (state) => {
    let results = state.backtestResults;
    return { results, id: state.id };
};

export default connect(mapStateToProps, { viewStock, setBacktestResults, setChartSettings })(Results);
