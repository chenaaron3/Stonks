import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../store'

import Indicator from '../../types/indicator';

// Define a type for the slice state
interface IndicatorState {
    options: Indicator.Indicators;
    actives: Set<Indicator.IndicatorNames>;
}

// Define the initial state using that type
const initialState: IndicatorState = {
    options: {},
    actives: new Set()
}

export const indicatorSlice = createSlice({
    name: 'indicator',
    // `createSlice` will infer the state type from the `initialState` argument
    initialState,
    reducers: {
        // Use the PayloadAction type to declare the contents of `action.payload`
        setIndicatorOption: (state, action: PayloadAction<{ indicatorName: Indicator.IndicatorNames, field: string, value: any }>) => {
            let entry = { [action.payload.field]: action.payload.value };
            if (!state.options.hasOwnProperty(action.payload.indicatorName)) {
                state.options[action.payload.indicatorName] = {} as any;
            }
            Object.assign(state.options[action.payload.indicatorName], entry);
        },
        setIndicatorOn: (state, action: PayloadAction<{ indicatorName: Indicator.IndicatorNames, on: boolean }>) => {
            if (action.payload.on) {
                state.actives.add(action.payload.indicatorName);
            }
            else {
                state.actives.delete(action.payload.indicatorName);
            }
        },
        clearIndicators: (state, action) => {
            state.actives = new Set();
        },
    },
})

export const { setIndicatorOption, setIndicatorOn, clearIndicators } = indicatorSlice.actions

// Other code such as selectors can use the imported `RootState` type
export const selectIndicatorOptions = (state: RootState) => state.indicator.options;
export const selectActiveIndicators = (state: RootState) => state.indicator.actives;

export default indicatorSlice.reducer