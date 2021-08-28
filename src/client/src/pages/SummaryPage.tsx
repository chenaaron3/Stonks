import React, { createRef } from 'react';
import './SummaryPage.css';
import MainLayout from "../layouts/MainLayout";
import Dashboard from "../components/Dashboard";
import { RouteComponentProps } from 'react-router';

const SummaryPage: React.FC<RouteComponentProps> = (props) => {
    return (
        <MainLayout {...props}>
            <Dashboard />
        </MainLayout>
    )
}

export default SummaryPage;