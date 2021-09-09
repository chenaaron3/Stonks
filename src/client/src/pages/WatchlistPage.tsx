import React, { } from 'react';
import './WatchlistPage.css';
import MainLayout from "../layouts/MainLayout";
import Watchlist from "../components/Watchlist"

const WatchlistPage = () => {
    return <MainLayout >
        <Watchlist />
    </MainLayout>
}

export default WatchlistPage;