import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../store'

import Backtest from '../../types/backtest';

interface SimulationTransactionsData {
    [key: string]: Backtest.EventData[];
}

// Define a type for the slice state
interface BacktestState {
    id: string;
    results: Backtest.ResultsData;
    simulationTransactions: SimulationTransactionsData;
    selectedSymbol: string;
    selectedEvent: number;
}

// Define the initial state using that type
const initialState: BacktestState = {
    id: '',
    results: null!,
    simulationTransactions: {},
    selectedSymbol: '',
    selectedEvent: -1
}

export const backtestSlice = createSlice({
    name: 'backtest',
    // `createSlice` will infer the state type from the `initialState` argument
    initialState,
    reducers: {
        // Use the PayloadAction type to declare the contents of `action.payload`
        setBacktestID: (state, action: PayloadAction<string>) => {
            state.id = action.payload;
        },
        setBacktestResults: (state, action: PayloadAction<{ results: Backtest.ResultsData, id: string }>) => {
            state.results = action.payload.results;
            state.id = action.payload.id;
        },
        viewSymbol: (state, action: PayloadAction<string>) => {
            state.selectedSymbol = action.payload;
        },
        viewEvent: (state, action: PayloadAction<number>) => {
            state.selectedEvent = action.payload;
        },
        setSimulationTransactions: (state, action: PayloadAction<SimulationTransactionsData>) => {
            state.simulationTransactions = action.payload;
        },
    },
})

export const { setBacktestID, setBacktestResults, viewSymbol, viewEvent, setSimulationTransactions } = backtestSlice.actions

// Other code such as selectors can use the imported `RootState` type
export const selectBacktestID = (state: RootState) => state.backtest.id;
export const selectBacktestResults = (state: RootState) => state.backtest.results;
export const selectSymbol = (state: RootState) => state.backtest.selectedSymbol;
export const selectEvent = (state: RootState) => state.backtest.selectedEvent;
export const selectSimulationTransactions = (state: RootState) => state.backtest.simulationTransactions;

export default backtestSlice.reducer