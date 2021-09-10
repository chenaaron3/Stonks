import React, { useState } from 'react';
import './MainLayout.css';
import Sidebar from '../components/Sidebar';
import Loading from '../components/Loading';
import { useHistory } from 'react-router-dom';

import { useAppSelector } from '../redux/hooks';

const MainLayout: React.FC = (props) => {
    const id = useAppSelector(state => state.backtest.id);
    const loading = useAppSelector(state => state.ui.loading);
    const history = useHistory();

    if (id == '') {
        console.log('ID IS BLANK!')
        history.push('/');
        return <></>;
    }
    return (
        <div className='main-layout'>
            <Loading loading={loading} />
            <div className='main-layout-sidebar'>
                <Sidebar />
            </div>
            <div className='main-layout-content'>
                {props.children}
            </div>
        </div>
    );
}

export default MainLayout;