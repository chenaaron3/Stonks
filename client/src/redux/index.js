// Actions
const VIEW_STOCK = "VIEW_STOCK";
const SET_RESULTS = "SET_RESULTS";
const SET_INDICATOR_OPTION = "SET_INDICATOR_OPTION";
const SET_INDICATOR_ON = "SET_INDICATOR_ON";

const initialState = {
    selectedSymbol: "",
    selectedResults: {},
    results: {},
    indicatorOptions: {},
    activeIndicators: new Set()
};

// Reducer
export default function reducer(state = initialState, action) {
    console.log(action);
    switch (action.type) {
        case VIEW_STOCK:
            return Object.assign({}, state, {
                selectedSymbol: action.symbol,
                selectedResults: action.results
            })
        case SET_RESULTS:
            return Object.assign({}, state, {
                results: action.results
            })
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
        default: return state;
    }
}

// Action Creators
export function viewStock(symbol, results) {
    return { type: VIEW_STOCK, symbol: symbol, results: results };
}

export function setResults(results) {
    return { type: SET_RESULTS, results };
}

export function setIndicatorOption(indicator, field, value) {
    return { type: SET_INDICATOR_OPTION, indicator, field, value };
}

export function setIndicatorOn(indicator, on) {
    return { type: SET_INDICATOR_ON, indicator, on };
}