import React, { useState, useEffect } from 'react';
import './SavedResults.css';
import SavedResult from './SavedResult';
import Loading from './Loading';
import { getEndpoint } from '../helpers/api';
import { getBacktestDisplayName, checkLoggedIn } from '../helpers/utils';
import { useHistory, useParams } from 'react-router-dom';

import SwipeableDrawer from '@material-ui/core/SwipeableDrawer';
import MediaQuery from 'react-responsive'

import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { viewSymbol, setBacktestResults, setBacktestID } from '../redux/slices/backtestSlice';
import { setSavedResults } from '../redux/slices/userSlice';
import { setPageIndex, setDrawer } from '../redux/slices/uiSlice';

import { SavedResultsData } from '../types/common';
import API from '../types/api';
import { RouteMatchParams } from '../types/types';

const SavedResults: React.FC = (props) => {
    let { backtestID } = useParams<RouteMatchParams>();
    const history = useHistory();
    const dispatch = useAppDispatch();
    const [loading, setLoading] = useState(false);
    const savedResults = useAppSelector(state => state.user.savedResults);
    const drawer = useAppSelector(state => state.ui.drawer);

    let demoID = process.env.REACT_APP_DEMO_ID;

    // initial load of saved results
    useEffect(() => {
        // if link to specific backtest, go to it immediately
        if (backtestID) {
            console.log('Loading from backtestID', backtestID)
            fetchBacktestResults(backtestID);
            setLoading(true);
        }

        if (savedResults.length == 0) {
            let localSavedResults = [] as SavedResultsData;
            // create saved results if it doesnt exist
            if (!localStorage.getItem('savedResults')) {
                localSavedResults = [{ id: demoID, display: 'Demo' }] as SavedResultsData;
            }
            // load in locally saved results
            else {
                localSavedResults = JSON.parse(localStorage.getItem('savedResults')!) as SavedResultsData;
            }

            // check if demo exists
            if (!localSavedResults.some(e => e['id'] && e['id'] == demoID)) {
                // add demo if not exist
                localSavedResults.unshift({ id: demoID!, display: 'Demo' });
            }

            checkLoggedIn().then(async isLoggedIn => {
                // load saved results from account
                if (isLoggedIn) {
                    let userData = await getEndpoint<API.Users.GetData, API.Users._GetData>('users/data', {});
                    if ('error' in userData) { }
                    else {
                        let userSavedResults = userData.backtestIDs;
                        let currentSavedResults = new Set(savedResults.map(sr => sr.id));
                        // sync ids from the cloud to local
                        userSavedResults.forEach(userSavedResult => {
                            if (!currentSavedResults.has(userSavedResult.id)) {
                                localSavedResults.push(userSavedResult);
                                currentSavedResults.add(userSavedResult.id);
                            }
                        })
                    }
                }

                // push to global state
                dispatch(setSavedResults(localSavedResults))
            })
        }
    }, [])

    const fetchBacktestResults = (id: string) => {
        setLoading(true);
        getEndpoint<API.Index.GetResults, API.Index._GetResults>('results', { id })
            .then(res => {
                // if results are not ready
                if ('error' in res) {
                    alert(res.error);
                }
                else {
                    // save to local storage if not already in there
                    if (!id.includes('optimized') && !savedResults.some(r => r['id'] == id)) {
                        let updatedSavedResults = [...savedResults];
                        updatedSavedResults.push({ id, display: getBacktestDisplayName(res.strategyOptions) });
                        dispatch(setSavedResults(updatedSavedResults));
                    }

                    // store results in global state
                    dispatch(setBacktestResults({ results: res, id: id }));
                    dispatch(setBacktestID(id));
                    // preview first stock
                    dispatch(viewSymbol({ symbol: Object.keys(res.symbolData)[0] }));
                    // set active page to summary
                    dispatch(setPageIndex(1));

                    // go to next page
                    history.push('summary');
                }
                setLoading(false);
            });
    }

    // change display name for saved results
    const editSavedResults = (id: string, newDisplay: string) => {
        let newSave = [] as SavedResultsData;
        savedResults.forEach(save => {
            if (save['id'] == id) {
                newSave.push({ id, display: newDisplay });
            }
            else {
                newSave.push(save);
            }
        })

        dispatch(setSavedResults(newSave));
    }

    // remove a saved result
    const removeSavedResults = (id: string) => {
        let newSave = [] as SavedResultsData;
        savedResults.forEach(save => {
            if (save['id'] != id) {
                newSave.push(save);
            }
        })

        dispatch(setSavedResults(newSave));

        // remove result from database
        fetch(`${process.env.NODE_ENV == 'production' ? process.env.REACT_APP_SUBDIRECTORY : ''}/deleteResults/?id=${id}`, {
            method: 'DELETE'
        })
    }

    let reversedResults = [...savedResults].reverse();
    let desktopVersion = <div className='saved-results'>
        <Loading loading={loading} />
        <h1 className='saved-results-title'>Saved Results</h1>
        <div className='saved-results-list'>
            {savedResults.length == 0 && (<span>
                There are no past results...
            </span>)
            }
            {savedResults.length != 0 && (
                reversedResults.map((save, index) => {
                    return <SavedResult id={save['id']} display={save['display']} fetchBacktestResults={fetchBacktestResults}
                        editSavedResults={editSavedResults} removeSavedResults={removeSavedResults} key={`saved-results-${save['id']}`} />
                })
            )
            }
        </div>
    </div>

    let mobileVersion = <SwipeableDrawer
        anchor='left'
        open={drawer['left']}
        onClose={() => dispatch(setDrawer({ anchor: 'left', open: false }))}
        onOpen={() => dispatch(setDrawer({ anchor: 'left', open: true }))}
    >
        {desktopVersion}
    </SwipeableDrawer>

    return <>
        <MediaQuery maxWidth={600}>
            {mobileVersion}
        </MediaQuery>
        <MediaQuery minWidth={600}>
            {desktopVersion}
        </MediaQuery>
    </>;
}

export default SavedResults;