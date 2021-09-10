import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../store'

import { DrawerState } from '../../types/types';

// Define a type for the slice state
interface UIState {
    pageIndex: number;
    drawer: {
        top: boolean;
        bottom: boolean;
        left: boolean;
        right: boolean;
    };
    loading: boolean;
}

// Define the initial state using that type
const initialState: UIState = {
    pageIndex: 0,
    drawer: {
        top: false,
        bottom: false,
        left: false,
        right: false
    },
    loading: false
}

export const uiSlice = createSlice({
    name: 'ui',
    // `createSlice` will infer the state type from the `initialState` argument
    initialState,
    reducers: {
        // Use the PayloadAction type to declare the contents of `action.payload`
        setPageIndex: (state, action: PayloadAction<number>) => {
            state.pageIndex = action.payload;
        },
        setDrawer: (state, action: PayloadAction<DrawerState>) => {
            state.drawer[action.payload.anchor] = action.payload.open;
        },
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
        }
    },
})

export const { setPageIndex, setDrawer, setLoading } = uiSlice.actions

// Other code such as selectors can use the imported `RootState` type
export const selectPageIndex = (state: RootState) => state.ui.pageIndex;
export const selectDrawer = (state: RootState) => state.ui.drawer;

export default uiSlice.reducer