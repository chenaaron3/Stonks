import React, { useState } from 'react';
import './MainLayout.css';
import Sidebar from '../components/Sidebar';
import { RouteComponentProps } from 'react-router';
import { useHistory } from 'react-router-dom';

import { useAppSelector } from '../redux/hooks';

const MainLayout: React.FC = (props) => {
    const id = useAppSelector(state => state.backtest.id);
    const history = useHistory();

    if (id == '') {
        console.log('ID IS BLANK!')
        history.push('/');
        return <></>;
    }
    return (
        <div className='main-layout'>
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