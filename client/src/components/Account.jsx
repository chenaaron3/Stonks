import React, { createRef } from 'react';
import "./Account.css";
import Card from '@material-ui/core/Card';
import TextField from '@material-ui/core/TextField';
import IconButton from '@material-ui/core/IconButton';
import Button from '@material-ui/core/Button';
import Box from '@material-ui/core/Box';
import { checkLoggedIn } from '../helpers/utils'
import EditOutlinedIcon from '@material-ui/icons/EditOutlined';
import SaveOutlinedIcon from '@material-ui/icons/SaveOutlined';

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
            alpaca: { key: "", id: "" },
            edit: { alpaca: false }
        }
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
                        this.setState({ alpaca: json["alpaca"] })
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
        this.setState({ edit: { ...this.state.edit, [formName]: newValue } });

        // if done editting
        if (newValue == false) {
            fetch(`${process.env.NODE_ENV == "production" ? process.env.REACT_APP_SUBDIRECTORY : ""}/users/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ field: formName, value: this.state[formName] })
            })
        }
    }

    render() {
        console.log(this.state.edit["alpaca"])
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
                    <div className="account-card">
                        <h3 className="account-card-title">Alpaca Credentials</h3>
                        <TextField label="Alpaca ID" value={this.state["alpaca"]["id"]} style={{ minWidth: "15vw", marginBottom: "2vh" }}
                            onChange={(e) => {
                                this.setState({ alpaca: { ...this.state["alpaca"], id: e.target.value } })
                            }}
                            InputProps={{
                                readOnly: !this.state.edit["alpaca"],
                            }} />
                        <TextField label="Alpaca Key" value={this.state["alpaca"]["key"]} style={{ minWidth: "15vw", marginBottom: "2vh" }}
                            onChange={(e) => {
                                this.setState({ alpaca: { ...this.state["alpaca"], key: e.target.value } })
                            }}
                            InputProps={{
                                readOnly: !this.state.edit["alpaca"],
                            }} />
                        <IconButton
                            aria-label="more"
                            aria-controls="long-menu"
                            aria-haspopup="true"
                            onClick={() => this.toggleEdit("alpaca")}
                            style={{ position: "absolute", top: "1vh", right: "1vh" }}
                        >
                            {!this.state.edit["alpaca"] && <EditOutlinedIcon />}
                            {this.state.edit["alpaca"] && <SaveOutlinedIcon />}
                        </IconButton>
                    </div>
                </div>
            }
        </div >
    }
}

export default Account;