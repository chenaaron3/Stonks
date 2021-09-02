import axios from 'axios';
import Backtest from '../types/backtest';
import API from '../types/api';

function getEndpoint<TQuery, TResponse>(endpoint: string, params: TQuery) {
    return new Promise<TResponse>(resolve => {
        axios.get<TResponse>(`${process.env.NODE_ENV == 'production' ? process.env.REACT_APP_SUBDIRECTORY : ''}/${endpoint}`, {
            params: params
        })
            .then(res => resolve(res.data));
    })
}

function postEndpoint<TBody, TResponse>(endpoint: string, body: TBody) {
    return new Promise<TResponse>(resolve => {
        axios.post<TResponse>(`${process.env.NODE_ENV == 'production' ? process.env.REACT_APP_SUBDIRECTORY : ''}/${endpoint}`, body)
            .then(res => resolve(res.data));
    })
}

const fetchBacktestResults = (id: string) => {
    return new Promise<Backtest.ResultsData>(resolve => {
        // get the data from the server
        getEndpoint<API.Index.GetResults, API.Index._GetResults>('results', { id })
            .then(results => {
                if ('error' in results) {
                    alert(results.error);
                }
                else {
                    resolve(results);
                }
            })
    })
}

export { getEndpoint, postEndpoint, fetchBacktestResults }