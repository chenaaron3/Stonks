// Actions
const SET_BACKTEST_RESULTS = "SET_BACKTEST_RESULTS";
const VIEW_STOCK = "VIEW_STOCK";
const VIEW_EVENT = "VIEW_EVENT";
const SET_ID = "SET_ID";
const SET_INDICATOR_OPTION = "SET_INDICATOR_OPTION";
const SET_INDICATOR_ON = "SET_INDICATOR_ON";
const CLEAR_INDICATORS = "CLEAR_INDICATORS";
const SET_SAVED_RESULTS = "SET_SAVED_RESULTS";
const SET_PAGE_INDEX = "SET_PAGE_INDEX";
const SET_CHART_SETTINGS = "SET_CHART_SETTINGS";
const SET_SIMULATION_TRANSACTIONS = "SET_SIMULATION_TRANSACTIONS";
const SET_DRAWER = "SET_DRAWER";
const SET_TRADE_SETTINGS = "SET_TRADE_SETTINGS";
const SET_CLOSED_ORDERS = "SET_CLOSED_ORDERS";

const initialState = {
    id: "",
    backtestResults: {},
    selectedSymbol: "",
    indicatorOptions: {},
    activeIndicators: new Set(),
    savedResults: [],
    eventIndex: -1,
    boughtSymbols: {},
    pageIndex: 1,
    chartSettings: {},
    simulationTransactions: {},
    drawer: {},
    tradeSettings: { scoreBy: "Win Rate", maxRisk: 15 },
    closedOrders: {}
};

// Reducer
export default function reducer(state = initialState, action) {
    console.log("ACTION", action);
    switch (action.type) {
        case SET_BACKTEST_RESULTS:
            return Object.assign({}, state, {
                id: action.id,
                backtestResults: action.backtestResults,
            })
        case VIEW_STOCK:
            return Object.assign({}, state, {
                selectedSymbol: action.symbol,
                selectedResults: action.results,
                eventIndex: action.eventIndex
            })
        case VIEW_EVENT:
            return Object.assign({}, state, {
                eventIndex: action.eventIndex
            })
        case SET_ID:
            return {
                ...state,
                id: action.id
            }
        case SET_INDICATOR_OPTION:
            return {
                ...state,
                indicatorOptions: {
                    ...state.indicatorOptions,
                    [action.indicator]: {
                        ...state.indicatorOptions[action.indicator],
                        [action.field]: action.value
                    }
                }
            }
        case SET_INDICATOR_ON:
            let newActive = new Set(state.activeIndicators);
            if (action.on) {
                newActive.add(action.indicator);
            }
            else {
                newActive.delete(action.indicator)
            }
            return Object.assign({}, state, {
                activeIndicators: newActive
            })
        case CLEAR_INDICATORS:
            return {
                ...state,
                activeIndicators: new Set()
            }
        case SET_SAVED_RESULTS:
            return {
                ...state,
                savedResults: action.savedResults
            }
        case SET_PAGE_INDEX:
            return {
                ...state,
                pageIndex: action.pageIndex
            }
        case SET_CHART_SETTINGS:
            return {
                ...state,
                chartSettings: action.chartSettings
            }
        case SET_SIMULATION_TRANSACTIONS:
            return {
                ...state,
                simulationTransactions: action.simulationTransactions
            }
        case SET_DRAWER:
            return {
                ...state,
                drawer: {
                    ...state.drawer,
                    [action.anchor]: action.open
                }
            }
        case SET_TRADE_SETTINGS:
            return {
                ...state,
                tradeSettings: action.settings
            }
        case SET_CLOSED_ORDERS:
            return {
                ...state,
                closedOrders: action.closedOrders
            }
        default: return state;
    }
}

// Action Creators
export function setBacktestResults(id, backtestResults) {
    return { type: SET_BACKTEST_RESULTS, id, backtestResults };
}

export function viewStock(symbol, eventIndex = -1) {
    return { type: VIEW_STOCK, symbol, eventIndex };
}

export function viewEvent(eventIndex) {
    return { type: VIEW_EVENT, eventIndex };
}

export function setID(id) {
    return { type: SET_ID, id };
}

export function setIndicatorOption(indicator, field, value) {
    return { type: SET_INDICATOR_OPTION, indicator, field, value };
}

export function setIndicatorOn(indicator, on) {
    return { type: SET_INDICATOR_ON, indicator, on };
}

export function clearIndicators() {
    return { type: CLEAR_INDICATORS }
}

export function setSavedResults(savedResults) {
    // sync with cloud
    fetch(`${process.env.NODE_ENV == "production" ? process.env.REACT_APP_SUBDIRECTORY : ""}/users/data`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ field: "backtestIDs", value: savedResults })
    })
    return { type: SET_SAVED_RESULTS, savedResults }
}

export function setPageIndex(pageIndex) {
    return { type: SET_PAGE_INDEX, pageIndex }
}

export function setChartSettings(chartSettings) {
    return { type: SET_CHART_SETTINGS, chartSettings }
}

export function setSimulationTransactions(simulationTransactions) {
    return { type: SET_SIMULATION_TRANSACTIONS, simulationTransactions }
}

export function setDrawer(anchor, open) {
    return { type: SET_DRAWER, anchor, open }
}

export function setTradeSettings(settings) {
    return { type: SET_TRADE_SETTINGS, settings }
}

export function setClosedOrders(closedOrders) {
    return { type: SET_CLOSED_ORDERS, closedOrders }
}