import React, { createRef } from 'react';
import { connect } from 'react-redux';
import './MainLayout.css';
import Sidebar from "../components/Sidebar";

class MainLayout extends React.Component {
    render() {
        if (this.props.id == "") {
            this.props.history.push("/");
            return <></>;
        }
        return (
            <div className="main-layout">
                <div className="main-layout-sidebar">
                    <Sidebar history={this.props.history} />
                </div>
                <div className="main-layout-content">
                    {this.props.children}
                </div>
            </div>
        );
    }
}

let mapStateToProps = (state) => {
    return { id: state.id };
};

export default connect(mapStateToProps)(MainLayout);