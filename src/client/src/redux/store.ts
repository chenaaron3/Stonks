import { configureStore } from '@reduxjs/toolkit'
import uiReducer from './slices/uiSlice';
import backtestReducer from './slices/backtestSlice';
import indicatorReducer from './slices/indicatorSlice';
import userReducer from './slices/userSlice';
import { enableMapSet } from 'immer';

enableMapSet();

export const store = configureStore({
    reducer: {
        ui: uiReducer,
        backtest: backtestReducer,
        indicator: indicatorReducer,
        user: userReducer
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({ immutableCheck: false })
})

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>
// Inferred type
export type AppDispatch = typeof store.dispatch