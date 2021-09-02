import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit'
import type { RootState } from '../store'
import axios from 'axios';

import { ClosedOrdersData, SavedResultsData, TradeSettingsData } from '../../types/common';
import { ChartSettingsData } from '../../types/types';

export const setSavedResults = createAsyncThunk(
    'user/setSavedResults',
    async (payload: SavedResultsData) => {
        axios.post(`${process.env.NODE_ENV === "production" ? process.env.REACT_APP_SUBDIRECTORY : ""}/users/data`, {
            field: "backtestIDs",
            value: payload
        });

        localStorage.setItem("savedResults", JSON.stringify(payload));
        return payload;
    }
)

// Define a type for the slice state
interface UserState {
    closedOrders: ClosedOrdersData;
    savedResults: SavedResultsData;
    tradeSettings: TradeSettingsData;
    chartSettings: ChartSettingsData;
}

// Define the initial state using that type
const initialState: UserState = {
    closedOrders: {},
    savedResults: [],
    tradeSettings: {},
    chartSettings: { 'Candles': false, 'Support Lines': false, 'Test Mode': false }
}

export const userSlice = createSlice({
    name: 'user',
    // `createSlice` will infer the state type from the `initialState` argument
    initialState,
    reducers: {
        // Use the PayloadAction type to declare the contents of `action.payload`
        setClosedOrders: (state, action: PayloadAction<ClosedOrdersData>) => {
            state.closedOrders = action.payload;
        },
        setTradeSettings: (state, action: PayloadAction<TradeSettingsData>) => {
            state.tradeSettings = action.payload;
        },
        setChartSettings: (state, action: PayloadAction<ChartSettingsData>) => {
            state.chartSettings = action.payload;
        },
    },
    extraReducers: (builder) => {
        // Add reducers for additional action types here, and handle loading state as needed
        builder.addCase(setSavedResults.fulfilled, (state, action) => {
            state.savedResults = action.payload;
        })
    }
})

export const { setClosedOrders, setTradeSettings, setChartSettings } = userSlice.actions

// Other code such as selectors can use the imported `RootState` type
export const selectClosedOrders = (state: RootState) => state.user.closedOrders;
export const selectSavedResults = (state: RootState) => state.user.savedResults;
export const selectTradeSettings = (state: RootState) => state.user.tradeSettings;
export const selectChartSettings = (state: RootState) => state.user.chartSettings;

export default userSlice.reducer