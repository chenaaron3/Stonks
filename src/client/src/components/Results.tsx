import React, { useState, useEffect } from 'react';
import './Results.css';
import 'react-tabs/style/react-tabs.css';
import eye from '../images/eye.svg';
import buy from '../images/buy.svg';
import bought from '../images/bought.svg';
import sell from '../images/sell.svg';
import { formatDate, daysBetween, displayDelta, sortResultsByScore } from '../helpers/utils';
import { getEndpoint, postEndpoint } from '../helpers/api';

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
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import Select from '@material-ui/core/Select';
import Accordion from '@material-ui/core/Accordion';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import MenuIcon from '@material-ui/icons/Menu';
import MediaQuery from 'react-responsive'
import SwipeableDrawer from '@material-ui/core/SwipeableDrawer';

import { viewSymbol, viewEvent, setBacktestResults } from '../redux/slices/backtestSlice';
import { setChartSettings, setClosedOrders } from '../redux/slices/userSlice';
import { setDrawer } from '../redux/slices/uiSlice';
import { useAppDispatch, useAppSelector } from '../redux/hooks';

import { BoughtSymbolData, SortBy, ClosedOrderData, ClosedOrdersData, ExportType } from '../types/common';
import { ChartSettingsData } from '../types/types';
import API from '../types/api';
import Backtest from '../types/backtest';

const Results: React.FC = () => {
    const dispatch = useAppDispatch();
    const results = useAppSelector(state => state.backtest.results);
    const id = useAppSelector(state => state.backtest.id);
    const simulationTransactions = useAppSelector(state => state.backtest.simulationTransactions);
    const drawer = useAppSelector(state => state.ui.drawer);
    const closedOrders = useAppSelector(state => state.user.closedOrders);
    const chartSettings = useAppSelector(state => state.user.chartSettings);

    const [sortedSymbols, setSortedSymbols] = useState<string[]>([]);
    const [recentThreshold, setRecentThreshold] = useState(0);
    const [maxRisk, setMaxRisk] = useState(50);
    const [boughtSymbols, setBoughtSymbols] = useState<BoughtSymbolData>({});
    const [search, setSearch] = useState('');
    const [updateProgress, setUpdateProgress] = useState(-1);
    const [tabIndex, setTabIndex] = useState(0);
    const [scoreBy, setScoreBy] = useState<SortBy>('Win Rate');
    const [ready, setReady] = useState(false);

    const scoreTypes: SortBy[] = ['Percent Profit', 'Dollar Profit', 'Win Rate'];
    const supportedExports: ExportType[] = ['StocksTracker', 'Finviz'];


    useEffect(() => {
        analyze();
        getBoughtSymbols();
        getClosedOrders();
    }, [id])

    useEffect(() => {
        analyze();
    }, [scoreBy])

    // when clicking on an item
    const handleGetResult = (symbol: string) => {
        dispatch(viewSymbol(symbol))
    }

    // sort symbols
    const analyze = () => {
        // get the sorted symbols
        let sortedSymbols = sortResultsByScore(results, scoreBy);
        setSortedSymbols(sortedSymbols);
        setReady(true);
    }

    // if has alpaca account, get orders to compare
    const getClosedOrders = () => {
        // if have not gotten orders yet
        if (Object.keys(closedOrders).length == 0) {
            getEndpoint<API.Alpaca.GetClosedOrders, API.Alpaca._GetClosedOrders>('alpaca/closedOrders', {})
                .then(closedOrders => {
                    let ordersBySymbol: ClosedOrdersData = {};
                    // categorize each order by their symbol
                    closedOrders.forEach(closedOrder => {
                        // dont care about cancelled orders
                        if (closedOrder.status === 'canceled') {
                            return;
                        }

                        let symbol = closedOrder['symbol'];
                        let price = parseFloat(closedOrder['filled_avg_price'].toString());
                        let date = new Date(closedOrder['filled_at']);
                        let side = closedOrder['side'];
                        if (!ordersBySymbol.hasOwnProperty(symbol)) {
                            ordersBySymbol[symbol] = [{}];
                        }

                        // add fresh event
                        let hasBuy = ordersBySymbol[symbol][0].hasOwnProperty('buyPrice');
                        let hasSell = ordersBySymbol[symbol][0].hasOwnProperty('sellPrice');
                        if (hasBuy) {
                            if (hasSell) {
                                ordersBySymbol[symbol].unshift({});
                            }
                        }
                        else {

                        }

                        let event = ordersBySymbol[symbol][0];
                        // sell order
                        if (side == 'sell' && price) {
                            event['sellPrice'] = price;
                            event['sellDate'] = date;
                        }
                        // buy order
                        else if (side == 'buy') {
                            event['buyPrice'] = price;
                            event['buyDate'] = date;
                        }
                    })
                    setClosedOrders(ordersBySymbol);
                })
        }
    }

    // load initial bought list
    const getBoughtSymbols = () => {
        getEndpoint<API.Symbol.GetBoughtSymbols, API.Symbol._GetBoughtSymbols>('symbol/boughtSymbols', {})
            .then(boughtSymbols => {
                setBoughtSymbols(boughtSymbols);
            })
    }

    // mark as bought
    const buySymbol = (symbol: string) => {
        getEndpoint<API.Symbol.GetBuySymbol, API.Symbol._GetBuySymbol>('symbol/buySymbol', { symbol })
            .then(boughtSymbols => {
                setBoughtSymbols(boughtSymbols);
            })
    }

    // sell
    const sellSymbol = (symbol: string) => {
        getEndpoint<API.Symbol.GetSellSymbol, API.Symbol._GetSellSymbol>('symbol/sellSymbol', { symbol })
            .then(boughtSymbols => {
                setBoughtSymbols(boughtSymbols);
            })
    }

    const onSettingChanged = (setting: keyof ChartSettingsData, state: boolean) => {
        dispatch(setChartSettings({ ...chartSettings, [setting]: state }));
    }

    // export buys
    const onExportClicked = (destination: ExportType) => {
        // store passwords locally
        if (!localStorage.getItem('exportInfo')) {
            localStorage.setItem('exportInfo', `{}`)
        }

        // get login if not stored
        let login = JSON.parse(localStorage.getItem('exportInfo') as string);
        if (!login[destination]) {
            login[destination] = {};
        }
        if (!login[destination]['username']) {
            login[destination]['username'] = prompt(`Enter your ${destination} username.`);
        }
        if (!login[destination]['password']) {
            login[destination]['password'] = prompt(`Enter your ${destination} password.`);
        }
        // store info back into local storage
        localStorage.setItem('exportInfo', JSON.stringify(login));
        // if cancel
        if (!login[destination]['username'] || !login[destination]['password']) {
            return;
        }

        // get watchist
        let watchlist = prompt('Enter the watchlist name.');
        if (!watchlist) {
            return;
        }

        // get symbols to export
        let symbolsToExport: string[] = [];
        sortedSymbols.forEach(symbol => {
            if (findHoldings(symbol)) {
                symbolsToExport.push(symbol);
            }
        })

        // make automation api request
        let data = { destination, symbols: symbolsToExport, login: login[destination], watchlist };
        postEndpoint<API.Users.PostWatchlist, API.Users._PostWatchlist>('users/watchlist', data)
            .then(json => alert(json['status']));
    }

    const findHoldings = (symbol: string) => {
        let lastRecentDate = new Date()
        lastRecentDate.setDate(lastRecentDate.getDate() - recentThreshold);
        return results.symbolData[symbol].holdings.find(holding => {
            let dateSatisfied = daysBetween(lastRecentDate, new Date(holding['buyDate'])) == 0;
            // filter by risk if supplied
            if (holding['stoplossTarget']) {
                let risk = holding['stoplossTarget']['risk'] ? holding['stoplossTarget']['risk'] : 0;
                return risk < maxRisk && dateSatisfied;
            }
            else {
                return dateSatisfied;
            }
        });
    }

    if (!ready) {
        return <></>;
    }

    let lastRecentDate = new Date()
    lastRecentDate.setDate(lastRecentDate.getDate() - recentThreshold);

    let searchLower = search.toLowerCase().trim();
    let searchResults = sortedSymbols.filter(s => s.toLowerCase().startsWith(searchLower));

    let searchBar = <Box mb='1vh'><TextField
        id='input-with-icon-textfield'
        value={search}
        onChange={e => { setSearch(e.target.value) }}
        InputProps={{
            startAdornment: (
                <InputAdornment position='start'>
                    <SearchOutlinedIcon />
                </InputAdornment>
            ),
        }}
    /></Box>

    let dayFilter = <div>
        <p className='results-dayfilter'>
            Show events {recentThreshold} days ago
        </p>
        <Box mx='1vw' mt='1vh'><Slider
            defaultValue={0}
            aria-labelledby='discrete-slider'
            valueLabelDisplay='auto'
            value={recentThreshold}
            onChange={(e, v) => { setRecentThreshold(v as number) }}
            step={1}
            marks
            min={0}
            max={32}
        /></Box>
    </div>

    let riskFilter = <div>
        <p className='results-dayfilter'>
            Max Risk is {maxRisk}%
        </p>
        <Box mx='1vw' mt='1vh'><Slider
            defaultValue={5}
            aria-labelledby='discrete-slider'
            valueLabelDisplay='auto'
            value={maxRisk}
            onChange={(e, v) => { setMaxRisk(v as number) }}
            step={5}
            marks
            min={5}
            max={50}
        /></Box>
    </div>

    let scoreByDropdown = <Box mx='1vw' mt='1vh'>
        <FormControl style={{ minWidth: '5vw' }}>
            <InputLabel id='results-score-type'>Sort By</InputLabel>
            <Select
                value={scoreTypes.indexOf(scoreBy)}
                onChange={(e) => {
                    setScoreBy(scoreTypes[e.target.value as number]);
                }}
            >
                {
                    scoreTypes.map((value, index) => {
                        return <MenuItem key={`results-score-${index}`} value={index}>{value}</MenuItem>
                    })
                }
            </Select>
        </FormControl>
    </Box>;

    let buySymbols = [];
    for (let i = 0; i < sortedSymbols.length; ++i) {
        let symbol = sortedSymbols[i];
        if (findHoldings(symbol)) {
            buySymbols.push({ symbol: symbol, index: i });
        }
    }

    let tabPanelStyle = { overflow: 'auto', overflowX: 'hidden' };

    let desktopVersion = (
        <>
            <div className='results'>
                <h2 className='results-title'>
                    Results {<SettingsMenu items={['Candles', 'Support Lines', 'Test Mode']} options={chartSettings} onChange={onSettingChanged} />}
                </h2>
                <div>{searchBar}</div>
                {scoreByDropdown}
                {/* <Paper square> */}
                <Tabs value={tabIndex} onChange={(e, v) => setTabIndex(v)} indicatorColor='primary' centered aria-label='simple tabs example'>
                    <Tab style={{ minWidth: '0vw' }} label='All' {...a11yProps(0)} />
                    <Tab style={{ minWidth: '0vw' }} label='Buy' {...a11yProps(1)} />
                    <Tab style={{ minWidth: '0vw' }} label='Sell' {...a11yProps(2)} />
                    <Tab style={{ minWidth: '0vw' }} label='Watch' {...a11yProps(3)} />
                    <Tab style={{ minWidth: '0vw' }} label='Sim' {...a11yProps(4)} />
                </Tabs>
                {/* </Paper> */}
                {/* All Symbols */}
                <TabPanel value={tabIndex} index={0} style={tabPanelStyle}>
                    <div className='results-list'>
                        {sortedSymbols.length == 0 && (<span>
                            There are no results...
                        </span>)
                        }
                        {sortedSymbols.length != 0 && (
                            <>
                                {
                                    sortedSymbols.map((symbol, index) => {
                                        if (searchResults.includes(symbol)) {
                                            return <Result buy key={index} symbol={symbol} index={index} result={results['symbolData'][symbol]}
                                                handleGetResult={handleGetResult} buySymbol={buySymbol} sellSymbol={sellSymbol}
                                                boughtSymbols={boughtSymbols} />
                                        }
                                    })
                                }
                            </>
                        )
                        }
                    </div>
                </TabPanel>
                {/* Bought Symbols */}
                <TabPanel value={tabIndex} index={1} style={tabPanelStyle}>
                    <div className='results-list'>
                        {sortedSymbols.length == 0 && (<span>
                            There are no results...
                        </span>)
                        }
                        {sortedSymbols.length != 0 && (
                            <>
                                <ExportMenu items={supportedExports} onClick={onExportClicked} />
                                {dayFilter}
                                {riskFilter}
                                {sortedSymbols.length != 0 && (
                                    buySymbols.map(({ symbol, index }) =>
                                        <Result sell key={index} symbol={symbol} index={index} result={results['symbolData'][symbol]}
                                            handleGetResult={handleGetResult} buySymbol={buySymbol} sellSymbol={sellSymbol}
                                            boughtSymbols={boughtSymbols} />)
                                )
                                }
                            </>
                        )
                        }
                    </div>
                </TabPanel>
                {/* Sell Symbols */}
                <TabPanel value={tabIndex} index={2} style={tabPanelStyle}>
                    <div className='results-list'>
                        {sortedSymbols.length == 0 && (<span>
                            There are no results...
                        </span>)
                        }
                        <>
                            {dayFilter}
                            {riskFilter}
                            {sortedSymbols.length != 0 && (
                                sortedSymbols.map((symbol, index) => {
                                    // only show if there are recent events
                                    let events = results['symbolData'][symbol]['events'];
                                    let numEvents = events.filter(e => {
                                        let risk = e['risk'] ? e['risk'] : 0;
                                        return risk < maxRisk && daysBetween(lastRecentDate, new Date(e['sellDate'])) == 0
                                    }).length;
                                    if (numEvents > 0) {
                                        if (searchResults.includes(symbol)) {
                                            return <Result sell key={index} symbol={symbol} index={index} result={results['symbolData'][symbol]}
                                                handleGetResult={handleGetResult} buySymbol={buySymbol} sellSymbol={sellSymbol}
                                                boughtSymbols={boughtSymbols} />
                                        }
                                    }
                                })
                            )
                            }
                        </>
                    </div>
                </TabPanel>
                {/* Watchlist Symbols */}
                <TabPanel value={tabIndex} index={3} style={tabPanelStyle}>
                    <div className='results-list'>
                        {sortedSymbols.length == 0 && (<span>
                            There are no results...
                        </span>)
                        }
                        <>
                            {sortedSymbols.length != 0 && (
                                sortedSymbols.map((symbol, index) => {
                                    // if in watchlist or on alpaca with open position
                                    if (boughtSymbols.hasOwnProperty(symbol) ||
                                        (closedOrders.hasOwnProperty(symbol)) && results['symbolData'][symbol]['holdings'].length > 0) {
                                        return <Result sell key={index} symbol={symbol} index={index} result={results['symbolData'][symbol]}
                                            handleGetResult={handleGetResult} buySymbol={buySymbol} sellSymbol={sellSymbol}
                                            boughtSymbols={boughtSymbols} />
                                    }
                                })
                            )
                            }
                        </>
                    </div>
                </TabPanel>
                {/* Simulation Symbols */}
                <TabPanel value={tabIndex} index={4} style={tabPanelStyle}>
                    <div className='results-list'>
                        {
                            Object.keys(simulationTransactions).length == 0 && (<span>
                                Start a simulation to view transactions.
                            </span>)
                        }
                        <>
                            {Object.keys(simulationTransactions).length != 0 && (
                                // sort years from recent to old
                                Object.keys(simulationTransactions).sort((a, b) => Number(b) - Number(a)).map((year) => {
                                    return <Transactions closedOrders={closedOrders} year={year}
                                        transactions={simulationTransactions[year]} results={results} />
                                })
                            )
                            }
                        </>
                    </div>
                </TabPanel>
            </div>
        </>
    );

    console.log(drawer)

    let mobileVersion = <>
        <div className='results-mobile'>
            <IconButton
                aria-label='more'
                aria-controls='long-menu'
                aria-haspopup='true'
                onClick={() => { setDrawer({ anchor: 'left', open: true }) }}
                style={{ position: 'absolute', top: '1vh', left: '1vh' }}
            >
                <MenuIcon />
            </IconButton>
        </div>
        <SwipeableDrawer
            anchor='left'
            open={drawer['left']}
            onClose={() => setDrawer({ anchor: 'left', open: false })}
            onOpen={() => setDrawer({ anchor: 'left', open: true })}
        >
            {desktopVersion}
        </SwipeableDrawer>
    </>

    return <>
        <MediaQuery maxWidth={600}>
            {mobileVersion}
        </MediaQuery>
        <MediaQuery minWidth={600}>
            {desktopVersion}
        </MediaQuery>
    </>
}

interface ResultProps {
    buy?: boolean;
    sell?: boolean;
    transaction?: boolean;
    symbol: string;
    index: number;
    result: Backtest.SymbolDataEntry;
    handleGetResult: (symbol: string) => void;
    buySymbol?: (symbol: string) => void;
    sellSymbol?: (symbol: string) => void;
    boughtSymbols?: BoughtSymbolData;
    eventIndex?: number;
    closedOrders?: ClosedOrderData[];
}

const Result: React.FC<ResultProps> = (props) => {
    const [hovered, setHovered] = useState(false);

    const buySymbol = () => {
        props.buySymbol!(props.symbol);
    }

    const sellSymbol = () => {
        props.sellSymbol!(props.symbol);
    }

    let displayName = props.symbol;
    let color = props.result['percentProfit'] > 0 ? 'green' : 'red';
    if (props.transaction) {
        let event = props.result['events'][props.eventIndex!];
        let pp = event['percentProfit'] * 100;
        displayName += ` (${displayDelta(pp)}%)`;
        color = pp > 0 ? 'green' : 'red';
        let closedOrder = undefined;
        // find the corresponding closed order to this transaction 
        if (props.closedOrders) {
            closedOrder = props.closedOrders.find(closedOrder =>
                closedOrder['buyDate'] && daysBetween(closedOrder['buyDate'], new Date(event['buyDate'])) <= 1
            )
        }
        if (closedOrder) {
            displayName += '*';
        }
    }
    return (
        <div className='result' onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
            <img className={`result-icon result-hover`} width='25px' height='25px' src={eye} alt='Eye'
                onClick={() => props.handleGetResult(props.symbol)} />
            <span className='result-text' style={{ color: color }}
                onClick={() => props.handleGetResult(props.symbol)} >{
                    `${props.index + 1}. ${displayName}`}
            </span>
            {
                buy && !props.boughtSymbols!.hasOwnProperty(props.symbol) && (
                    <img className={`result-trailer ${hovered ? 'result-hover' : ''}`} width='35px' height='35px' src={buy} alt='Buy'
                        onClick={buySymbol} />)
            }
            {
                buy && props.boughtSymbols!.hasOwnProperty(props.symbol) && (
                    <img className={`result-trailer result-hover`} width='35px' height='35px' src={bought} alt='Bought'
                        onClick={sellSymbol} />)
            }
            {
                sell && !props.boughtSymbols!.hasOwnProperty(props.symbol) && (
                    <img className={`result-trailer ${hovered ? 'result-hover' : ''}`} width='35px' height='35px' src={buy} alt='Buy'
                        onClick={buySymbol} />)
            }
            {
                sell && props.boughtSymbols!.hasOwnProperty(props.symbol) && (
                    <img className={`result-trailer result-hover`} width='35px' height='35px' src={sell} alt='Sell'
                        onClick={sellSymbol} />)
            }
        </div>);
}

interface TransactionsProps {
    closedOrders: ClosedOrdersData;
    year: string;
    transactions: Backtest.EventData[];
    results: Backtest.ResultsData;
}
const Transactions: React.FC<TransactionsProps> = ({ closedOrders, year, transactions, results }) => {
    const dispatch = useAppDispatch();
    return <Accordion>
        <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls='panel1a-content'
            id='panel1a-header'
        >
            {year}
        </AccordionSummary>
        <AccordionDetails>
            <div className='results-list'>
                {
                    transactions.map((transaction, index) => {
                        return <Result transaction key={index} symbol={transaction['symbol']} index={index} result={results['symbolData'][transaction['symbol']]}
                            eventIndex={transaction['index']}
                            handleGetResult={(symbol) => {
                                dispatch(viewSymbol(symbol));
                                dispatch(viewEvent(transaction['index']));
                            }}
                            closedOrders={closedOrders[transaction['symbol']]} />
                    })
                }
            </div>
        </AccordionDetails>
    </Accordion>
}

function a11yProps(index: number) {
    return {
        id: `simple-tab-${index}`,
        'aria-controls': `simple-tabpanel-${index}`,
    };
}

interface TabPanelProps {
    value: number;
    index: number;
    style: { [key: string]: any }
}
const TabPanel: React.FC<TabPanelProps> = (props) => {
    const { children, value, index, ...other } = props;

    return (
        <div
            role='tabpanel'
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

interface SettingsMenuProps {
    items: (keyof ChartSettingsData)[];
    options: ChartSettingsData;
    onChange: (setting: keyof ChartSettingsData, state: boolean) => void;
}

const SettingsMenu: React.FC<SettingsMenuProps> = (props) => {
    const [anchorEl, setAnchorEl] = React.useState<any>(null);

    const handleClose = () => {
        setAnchorEl(null);
    };

    return (
        <>
            <IconButton
                aria-label='more'
                aria-controls='long-menu'
                aria-haspopup='true'
                onClick={(event) => { setAnchorEl(event.currentTarget); }}
                style={{ position: 'absolute', top: 0, right: 0 }}
            >
                <SettingsIcon />
            </IconButton>
            <Menu
                id='settings-menu'
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
                                        color='primary'
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

interface ExportMenuProps {
    items: (ExportType)[];
    onClick: (destination: ExportType) => void;
}
const ExportMenu: React.FC<ExportMenuProps> = (props) => {
    const [anchorEl, setAnchorEl] = React.useState<any>(null);

    const handleClose = () => {
        setAnchorEl(null);
    };

    return (
        <>
            <IconButton
                aria-label='more'
                aria-controls='long-menu'
                aria-haspopup='true'
                onClick={(event) => { setAnchorEl(event.currentTarget); }}
                style={{ position: 'absolute', top: 0, right: 0 }}
                color='primary'
            >
                <ImportExportIcon />
            </IconButton>
            <Menu
                id='export-menu'
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

export default Results;
