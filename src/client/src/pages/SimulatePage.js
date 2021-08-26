import React, { createRef } from 'react';
import './SimulatePage.css';
import MainLayout from "../layouts/MainLayout";
import Simulate from "../components/Simulate"

class SimulatePage extends React.Component {
    render() {
        return <MainLayout {...this.props}>
            <Simulate />
        </MainLayout>
    }
}

export default SimulatePage;