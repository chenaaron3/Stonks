import React, { createRef } from 'react';
import { connect } from 'react-redux';
import './SimulatePage.css';
import Sidebar from "../components/Sidebar";
import Simulate from "../components/Simulate"

class SimulatePage extends React.Component {
    render() {
        if (this.props.id == "") {
            this.props.history.push("/");
            return <></>;
        }
        return (
            <div className="simulate-page">
                <div className="simulate-page-sidebar">
                    <Sidebar history={this.props.history} />
                </div>
                <div className="simulate-page-simulate">
                    <Simulate />
                </div>
            </div>
        );
    }
}

let mapStateToProps = (state) => {
    return { id: state.id };
};

export default connect(mapStateToProps)(SimulatePage);