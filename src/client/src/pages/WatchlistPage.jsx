import React, {  } from 'react';
import './WatchlistPage.css';
import MainLayout from "../layouts/MainLayout";
import Watchlist from "../components/Watchlist"

class WatchlistPage extends React.Component {
    render() {
        return <MainLayout {...this.props}>
            <Watchlist />
        </MainLayout>
    }
}

export default WatchlistPage;