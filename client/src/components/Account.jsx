import React, { createRef } from 'react';
import { connect } from 'react-redux';
import "./Account.css";
import { setTradeSettings } from '../redux';
import { checkLoggedIn } from '../helpers/utils'

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

class Account extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            email: "",
            password: "",
            passwordConfirmation: "",
            mode: "login",
            loggedIn: false,
            loading: true,
            edit: {}
        }

        this.formData = {
            "alpaca": {
                title: "Alpaca Credentials",
                fields: [
                    {
                        name: "Alpaca ID",
                        key: "id"
                    },
                    {
                        name: "Alpaca Key",
                        key: "key"
                    }
                ]
            },
            "tradeSettings": {
                title: "Trade Settings",
                fields: [
                    {
                        name: "Score By",
                        key: "scoreBy",
                        type: "select",
                        options: [
                            "Win Rate",
                            "Percent Profit"
                        ]
                    },
                    {
                        name: "Max Risk",
                        key: "maxRisk",
                        type: "number"
                    },
                    {
                        name: "Max Positions",
                        key: "maxPositions",
                        type: "number"
                    }
                ]
            }
        }

        Object.keys(this.formData).forEach(formID => {
            this.state[formID] = {};
            this.state["edit"][formID] = false;
        })
    }

    componentDidMount() {
        this.checkLoggedIn();
    }

    checkLoggedIn = async () => {
        checkLoggedIn().then(isLoggedIn => {
            this.setState({ isLoggedIn: isLoggedIn, loading: false })
            // fetch the settings
            if (isLoggedIn) {
                fetch(`${process.env.NODE_ENV == "production" ? process.env.REACT_APP_SUBDIRECTORY : ""}/users/data`)
                    .then(res => res.json())
                    .then(json => {
                        let tradeSettings = json["tradeSettings"][this.props.id] ? json["tradeSettings"][this.props.id] : {};
                        this.setState({ alpaca: json["alpaca"], tradeSettings })
                    })
            }
        })
    }

    login = () => {
        let body = { username: this.state.email, password: this.state.password };
        fetch(`${process.env.NODE_ENV == "production" ? process.env.REACT_APP_SUBDIRECTORY : ""}/users/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        }).then(res => res.json())
            .then(json => {
                if (json["error"]) {
                    alert(json["error"]["message"]);
                }
                else {
                    this.checkLoggedIn();
                }
            })
    }

    register = () => {
        let emailRegex = /.*@.*/

        if (this.state.password != this.state.passwordConfirmation) {
            alert("Passwords do not match!");
        }
        else if (!emailRegex.test(this.state.email)) {
            alert("Invalid email!");
        }
        else {
            let body = { username: this.state.email, password: this.state.password };
            fetch(`${process.env.NODE_ENV == "production" ? process.env.REACT_APP_SUBDIRECTORY : ""}/users/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            }).then(res => res.json())
                .then(json => {
                    if (json["error"]) {
                        alert(json["error"]["message"]);
                    }
                    else {
                        // login after account successfully made
                        this.login();
                    }
                })
        }
    }

    logout = () => {
        fetch(`${process.env.NODE_ENV == "production" ? process.env.REACT_APP_SUBDIRECTORY : ""}/users/logout`)
            .then(res => res.json())
            .then(json => {
                this.checkLoggedIn();
            })
    }

    toggleEdit = (formName) => {
        let newValue = !this.state.edit[formName];
        // set form state to read
        this.setState({ edit: { ...this.state.edit, [formName]: newValue } });

        // if done editting, update the database
        if (newValue == false) {
            let body = { field: formName, value: this.state[formName] };
            if (formName == "tradeSettings") {
                body["field"] += "." + this.props.id;
                this.props.setTradeSettings(this.state[formName]);
            }

            fetch(`${process.env.NODE_ENV == "production" ? process.env.REACT_APP_SUBDIRECTORY : ""}/users/data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            })
        }
    }

    render() {
        return <div className="account">
            < div className="account-header" >
                <h3 className="account-title">Account</h3>
                {
                    this.state.isLoggedIn && <Button className="account-logout" variant="contained" onClick={this.logout} color="primary" fullWidth={false}>
                        Logout
                </Button>
                }
            </div >
            {(!this.state.isLoggedIn && !this.state.loading) && <div className="account-forms">
                {this.state.mode == "login" && <div className="account-form">
                    <span onClick={() => { this.setState({ mode: "register" }) }}>
                        Don't have an account? <span className="account-switch">Register Here.</span>
                    </span>
                    <TextField label="Email" value={this.state.email}
                        onChange={(e) => {
                            this.setState({ email: e.target.value })
                        }} />
                    <TextField label="Password" value={this.state.password}
                        onChange={(e) => {
                            this.setState({ password: e.target.value })
                        }}
                        type="password" />
                    <Box mt="3vh" width="100%">
                        <Button variant="contained" onClick={this.login} color="primary" fullWidth={true}>
                            Login
                        </Button>
                    </Box>
                </div>}
                {this.state.mode == "register" && <div className="account-form">
                    <span onClick={() => { this.setState({ mode: "login" }) }}>
                        Already have an account? <span className="account-switch">Login Here.</span>
                    </span>
                    <TextField label="Email" value={this.state.email}
                        onChange={(e) => {
                            this.setState({ email: e.target.value })
                        }} />
                    <TextField label="Password" value={this.state.password}
                        onChange={(e) => {
                            this.setState({ password: e.target.value })
                        }}
                        type="password" />
                    <TextField label="Confirm Password" value={this.state.passwordConfirmation}
                        onChange={(e) => {
                            this.setState({ passwordConfirmation: e.target.value })
                        }}
                        type="password" />
                    <Box mt="3vh" width="100%">
                        <Button variant="contained" onClick={this.register} color="primary" fullWidth={true}>
                            Register
                        </Button>
                    </Box>
                </div>}
            </div>
            }
            {
                (this.state.isLoggedIn && !this.state.loading) && <div className="account-info">
                    {
                        Object.keys(this.formData).map(formID => {
                            let form = this.formData[formID];
                            return <div className="account-card" key={`account-form-${formID}`}>
                                <h3 className="account-card-title">{form["title"]}</h3>
                                {
                                    form["fields"].map(field => {
                                        if (field["type"] == "select") {
                                            return <FormControl style={{ minWidth: "15vw", marginBottom: "2vh" }} key={`account-field-${field["name"]}`}>
                                                <InputLabel>{field["name"]}</InputLabel>
                                                <Select
                                                    value={this.state[formID][field["key"]] || ""}
                                                    onChange={(e) => {
                                                        this.setState({ [formID]: { ...this.state[formID], [field["key"]]: e.target.value } })
                                                    }}
                                                    disabled={!this.state.edit[formID]}
                                                >
                                                    {
                                                        field["options"].map((value) => {
                                                            return <MenuItem key={`account-field-option-${value}`} value={value}>{value}</MenuItem>
                                                        })
                                                    }
                                                </Select>
                                            </FormControl>
                                        }
                                        return <TextField key={`account-field-${field["name"]}`} label={field["name"]} value={this.state[formID][field["key"]] || ""}
                                            style={{ minWidth: "15vw", marginBottom: "2vh" }} type={field["type"]}
                                            onChange={(e) => {
                                                this.setState({ [formID]: { ...this.state[formID], [field["key"]]: e.target.value } })
                                            }}
                                            disabled={!this.state.edit[formID]} />
                                    })
                                }
                                <IconButton
                                    aria-label="more"
                                    aria-controls="long-menu"
                                    aria-haspopup="true"
                                    onClick={() => this.toggleEdit(formID)}
                                    style={{ position: "absolute", top: "1vh", right: "1vh" }}
                                >
                                    {!this.state.edit[formID] && <EditOutlinedIcon />}
                                    {this.state.edit[formID] && <SaveOutlinedIcon />}
                                </IconButton>
                            </div>
                        })
                    }
                </div>
            }
        </div >
    }
}

let mapStateToProps = (state) => {
    return { tradeSettings: state.tradeSettings, id: state.id };
};

export default connect(mapStateToProps, { setTradeSettings })(Account);