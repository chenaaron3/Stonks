import React, { createRef } from 'react';
import { connect } from 'react-redux';
import './MainLayout.css';
import Sidebar from "../components/Sidebar";
import Loading from '../components/Loading';

class MainLayout extends React.Component {
    state = {
        loading: false
    }

    render() {
        if (this.props.id == "") {
            this.props.history.push("/");
            return <></>;
        }
        return (
            <div className="main-layout">
                <Loading loading={this.state.loading}/>
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