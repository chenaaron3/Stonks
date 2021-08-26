import React, { createRef } from 'react';
import './SummaryPage.css';
import MainLayout from "../layouts/MainLayout";
import Dashboard from "../components/Dashboard";

class SummaryPage extends React.Component {
    render() {
        return (
            <MainLayout {...this.props}>
                <Dashboard />
            </MainLayout>
        )
    }
}

export default SummaryPage;