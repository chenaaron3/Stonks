import React, { createRef } from 'react';
import MainLayout from "../layouts/MainLayout";
import Dashboard from "../components/Optimize";

class OptimizePage extends React.Component {
    render() {
        return (
            <MainLayout {...this.props}>
                <Dashboard />
            </MainLayout>
        )
    }
}

export default OptimizePage;