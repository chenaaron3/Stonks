import React, { useState, useEffect } from 'react';
import './Account.css';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { setTradeSettings } from '../redux/slices/userSlice';
import { setLoading } from '../redux/slices/uiSlice';
import { checkLoggedIn } from '../helpers/utils'
import { getEndpoint, postEndpoint } from '../helpers/api';

import Card from '@material-ui/core/Card';
import TextField from '@material-ui/core/TextField';
import IconButton from '@material-ui/core/IconButton';
import Button from '@material-ui/core/Button';
import Box from '@material-ui/core/Box';
import EditOutlinedIcon from '@material-ui/icons/EditOutlined';
import SaveOutlinedIcon from '@material-ui/icons/SaveOutlined';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import Slider from '@material-ui/core/Slider';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';

import API from '../types/api';
import { SortBy, AlpacaCredentialsData, TradeSettingsData } from '../types/common';

type ModeTypes = 'login' | 'register';
interface FormsData {
    'alpaca': FormData;
    'tradeSettings': FormData;
}

interface FormData {
    title: string;
    fields: FormField[];
}

interface FormField {
    name: string;
    key: keyof AlpacaCredentialsData | keyof TradeSettingsData;
    type?: 'select' | 'number';
    options?: string[];
}

const Account = () => {
    const dispatch = useAppDispatch();
    const id = useAppSelector(state => state.backtest.id);
    const loading = useAppSelector(state => state.ui.loading);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [mode, setMode] = useState<ModeTypes>('login');
    const [loggedIn, setLoggedIn] = useState(false);
    const [forms, setForms] = useState({
        alpaca: {
            id: '',
            key: ''
        } as AlpacaCredentialsData,
        tradeSettings: {
            scoreBy: 'Percent Profit',
            maxRisk: 0,
            maxPositions: 0
        } as TradeSettingsData
    });
    const [edit, setEdit] = useState({
        alpaca: false,
        tradeSettings: false
    });

    const formsData: FormsData = {
        'alpaca': {
            title: 'Alpaca Credentials',
            fields: [
                {
                    name: 'Alpaca ID',
                    key: 'id'
                },
                {
                    name: 'Alpaca Key',
                    key: 'key'
                }
            ]
        },
        'tradeSettings': {
            title: 'Trade Settings',
            fields: [
                {
                    name: 'Score By',
                    key: 'scoreBy',
                    type: 'select',
                    options: [
                        'Win Rate',
                        'Percent Profit'
                    ]
                },
                {
                    name: 'Max Risk',
                    key: 'maxRisk',
                    type: 'number'
                },
                {
                    name: 'Max Positions',
                    key: 'maxPositions',
                    type: 'number'
                }
            ]
        }
    }

    useEffect(() => {
        updateUserData();
    }, []);

    const updateUserData = async () => {
        checkLoggedIn()
            .then(isLoggedIn => {
                setLoggedIn(isLoggedIn);
                dispatch(setLoading(false));

                // fetch the settings
                if (isLoggedIn) {
                    getEndpoint<API.Users.GetData, API.Users._GetData>('users/data', {})
                        .then(json => {
                            if ('error' in json) {
                                alert(json['error']);
                            }
                            else {
                                setEmail(json['_id']);
                                if (id in json['backtestSettings']) {
                                    let tradeSettings = json['backtestSettings'][id]['tradeSettings'] ? json['backtestSettings'][id]['tradeSettings'] : {};
                                    setForms({
                                        ...forms,
                                        alpaca: json['backtestSettings'][id]['alpaca'],
                                        tradeSettings: tradeSettings
                                    });
                                    dispatch(setTradeSettings(tradeSettings));
                                }
                            }
                        })
                }
            })
    }

    const login = () => {
        postEndpoint<API.Users.PostLogin, API.Users._PostLogin>('users/login', { username: email, password: password })
            .then(json => {
                if ('error' in json) {
                    alert(json['error']);
                }
                else {
                    updateUserData();
                }
            })
    }

    const register = () => {
        let emailRegex = /.*@.*/

        if (password != passwordConfirmation) {
            alert('Passwords do not match!');
        }
        else if (!emailRegex.test(email)) {
            alert('Invalid email!');
        }
        else {
            postEndpoint<API.Users.PostRegister, API.Users._PostRegister>('users/register', { username: email, password: password })
                .then(json => {
                    if ('error' in json) {
                        alert(json['error']);
                    }
                    else {
                        // login after account successfully made
                        login();
                    }
                })
        }
    }

    const logout = () => {
        getEndpoint<API.Users.GetLogout, API.Users._GetLogout>('users/logout', {})
            .then(json => {
                checkLoggedIn();
            })
    }

    const toggleEdit = (formName: keyof FormsData) => {
        let newValue = !edit[formName];
        // set form state to read
        setEdit({
            ...edit,
            [formName]: newValue
        })

        // if done editting
        if (newValue == false) {
            // validate alpaca credentials
            if (formName == 'alpaca') {
                postEndpoint<API.Alpaca.PostVerify, API.Alpaca._PostVerify>('alpaca/verify', forms[formName])
                    .then(res => {
                        if ('error' in res) {
                            alert(res['error']);
                            // set edit to true
                            setEdit({
                                ...edit,
                                [formName]: true
                            })
                        }
                        else {
                            alert(res['status']);
                            // update the database
                            let body = { field: `backtestSettings.${id}.${formName}`, value: forms[formName] };
                            postEndpoint<API.Users.PostData, API.Users._PostData>('users/data', body);
                        }
                    })
            }
            else {
                // update the database
                let body = { field: `backtestSettings.${id}.${formName}`, value: forms[formName] };
                postEndpoint<API.Users.PostData, API.Users._PostData>('users/data', body);
            }
        }
    }

    return <div className='account'>
        < div className='account-header' >
            <h3 className='account-title'>Account</h3>
            {
                loggedIn && <Button className='account-logout' variant='contained' onClick={logout} color='primary' fullWidth={false}>
                    Logout
                </Button>
            }
        </div >
        {/* Forms for Login/Register */}
        {(!loggedIn && !loading) && <div className='account-forms'>
            {mode == 'login' && <div className='account-form'>
                <span onClick={() => { setMode('register') }}>
                    Don't have an account? <span className='account-switch'>Register Here.</span>
                </span>
                <TextField label='Email' value={email}
                    onChange={(e) => {
                        setEmail(e.target.value as string)
                    }} />
                <TextField label='Password' value={password}
                    onChange={(e) => {
                        setPassword(e.target.value as string)
                    }}
                    type='password' />
                <Box mt='3vh' width='100%'>
                    <Button variant='contained' onClick={login} color='primary' fullWidth={true}>
                        Login
                    </Button>
                </Box>
            </div>}
            {mode == 'register' && <div className='account-form'>
                <span onClick={() => { setMode('login') }}>
                    Already have an account? <span className='account-switch'>Login Here.</span>
                </span>
                <TextField label='Email' value={email}
                    onChange={(e) => {
                        setEmail(e.target.value as string)
                    }} />
                <TextField label='Password' value={password}
                    onChange={(e) => {
                        setPassword(e.target.value as string)
                    }}
                    type='password' />
                <TextField label='Confirm Password' value={passwordConfirmation}
                    onChange={(e) => {
                        setPasswordConfirmation(e.target.value as string)
                    }}
                    type='password' />
                <Box mt='3vh' width='100%'>
                    <Button variant='contained' onClick={register} color='primary' fullWidth={true}>
                        Register
                    </Button>
                </Box>
            </div>}
        </div>
        }
        {/* Account Info */}
        {
            (loggedIn && !loading) && <div className='account-info'>
                <div className='account-card'>
                    <h3 className='account-card-title'>Account Information</h3>
                    Email: {email}
                </div>
                {
                    (Object.keys(forms) as (keyof FormsData)[]).map(formID => {
                        let form = formsData[formID];
                        return <div className='account-card' key={`account-form-${formID}`}>
                            <h3 className='account-card-title'>{form['title']}</h3>
                            {
                                form['fields'].map(field => {
                                    if (field['type'] == 'select') {
                                        return <FormControl style={{ minWidth: '15vw', marginBottom: '2vh' }} key={`account-field-${field['name']}`}>
                                            <InputLabel>{field['name']}</InputLabel>
                                            <Select
                                                value={(forms[formID] as any)[field['key']] || ''}
                                                onChange={(e) => {
                                                    setForms({
                                                        ...forms,
                                                        [formID]: {
                                                            ...forms[formID],
                                                            [field['key']]: e.target.value
                                                        }
                                                    })
                                                }}
                                                disabled={!edit[formID]}
                                            >
                                                {
                                                    field['options'] && field['options'].map((value) => {
                                                        return <MenuItem key={`account-field-option-${value}`} value={value}>{value}</MenuItem>
                                                    })
                                                }
                                            </Select>
                                        </FormControl>
                                    }
                                    return <TextField key={`account-field-${field['name']}`} label={field['name']} value={(forms[formID] as any)[field['key']] || ''}
                                        style={{ minWidth: '15vw', marginBottom: '2vh' }} type={field['type']}
                                        onChange={(e) => {
                                            let value: number | string = e.target.value;
                                            if (field['type'] == 'number') {
                                                value = parseInt(value);
                                                if (value == undefined) {
                                                    value = 0;
                                                }
                                            }
                                            setForms({
                                                ...forms,
                                                [formID]: {
                                                    ...forms[formID],
                                                    [field['key']]: value
                                                }
                                            })
                                        }}
                                        disabled={!edit[formID]} />
                                })
                            }
                            <IconButton
                                aria-label='more'
                                aria-controls='long-menu'
                                aria-haspopup='true'
                                onClick={() => toggleEdit(formID)}
                                style={{ position: 'absolute', top: '1vh', right: '1vh' }}
                            >
                                {!edit[formID] && <EditOutlinedIcon />}
                                {edit[formID] && <SaveOutlinedIcon />}
                            </IconButton>
                        </div>
                    })
                }
            </div>
        }
    </div >
}

export default Account;