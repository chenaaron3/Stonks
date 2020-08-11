// Actions
const SET_BACKTEST_RESULTS = "SET_BACKTEST_RESULTS";
const VIEW_STOCK = "VIEW_STOCK";
const SET_ID = "SET_ID";
const SET_INDICATOR_OPTION = "SET_INDICATOR_OPTION";
const SET_INDICATOR_ON = "SET_INDICATOR_ON";
const CLEAR_INDICATORS = "CLEAR_INDICATORS";
const SET_SAVED_RESULTS = "SET_SAVED_RESULTS";

const initialState = {
    id: "",
    backtestResults: {},
    selectedSymbol: "",
    indicatorOptions: {},
    activeIndicators: new Set(),
    savedResults: []
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
                selectedResults: action.results
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
        default: return state;
    }
}

// Action Creators
export function setBacktestResults(id, backtestResults) {
    return { type: SET_BACKTEST_RESULTS, id, backtestResults };
}

export function viewStock(symbol) {
    return { type: VIEW_STOCK, symbol };
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
    return { type: SET_SAVED_RESULTS, savedResults }
}