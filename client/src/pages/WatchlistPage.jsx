import React, { createRef } from 'react';
import { connect } from 'react-redux';
import './WatchlistPage.css';
import Sidebar from "../components/Sidebar";
import Watchlist from "../components/Watchlist"

class WatchlistPage extends React.Component {
    render() {
        if (this.props.id == "") {
            this.props.history.push("/");
            return <></>;
        }
        return (
            <div className="watchlist-page">
                <div className="watchlist-page-sidebar">
                    <Sidebar history={this.props.history} />
                </div>
                <div className="watchlist-page-watchlist">
                    <Watchlist />
                </div>
            </div>
        );
    }
}

let mapStateToProps = (state) => {
    return { id: state.id };
};

export default connect(mapStateToProps)(WatchlistPage);