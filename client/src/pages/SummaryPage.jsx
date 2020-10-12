import React, { createRef } from 'react';
import { connect } from 'react-redux';
import './SummaryPage.css';
import Sidebar from "../components/Sidebar";
import Dashboard from "../components/Dashboard";

class SummaryPage extends React.Component {
    render() {
        if (this.props.id == "") {
            this.props.history.push("/");
            return <></>;
        }
        return (
            <div className="summary-page">
                <div className="summary-page-sidebar">
                    <Sidebar history={this.props.history} />
                </div>
                <div className="summary-page-dashboard">
                    <Dashboard />
                </div>
            </div>
        );
    }
}

let mapStateToProps = (state) => {
    return { id: state.id };
};

export default connect(mapStateToProps)(SummaryPage);