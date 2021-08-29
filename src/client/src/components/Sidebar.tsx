import React, {  } from 'react';
import './Sidebar.css';
import { useHistory } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../redux/hooks';
import { setPageIndex } from '../redux/slices/uiSlice';

import HomeIcon from '@material-ui/icons/Home';
import EqualizerIcon from '@material-ui/icons/Equalizer';
import SearchIcon from '@material-ui/icons/Search';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import SettingsIcon from '@material-ui/icons/Settings';
import WatchLaterOutlinedIcon from '@material-ui/icons/WatchLaterOutlined';
import PersonOutlineOutlinedIcon from '@material-ui/icons/PersonOutlineOutlined';

let pageName = ['/', '/summary', '/review', '/simulate', '/optimize', '/watchlist', '/account'];
let icons = [HomeIcon, EqualizerIcon, SearchIcon, PlayArrowIcon, SettingsIcon, WatchLaterOutlinedIcon, PersonOutlineOutlinedIcon];
let label = ['Home', 'Summary', 'Review', 'Simulate', 'Optimize', 'Watchlist', 'Account']

const Sidebar: React.FC = (props) => {
    const dispatch = useAppDispatch();
    const history = useHistory();
    const pageIndex = useAppSelector(state => state.ui.pageIndex);

    return <div className='sidebar'>
        <div className='sidebar-icon-list'>
            {
                icons.map((icon, index) => {
                    let color = index == pageIndex ? '#2ecc71' : '';
                    let IconClass = icon;
                    let iconComponent = <IconClass fontSize='large' style={{ color: color }} />;
                    return <div className='sidebar-icon-wrapper' key={`sidebar-${index}`} onClick={() => {
                        dispatch(setPageIndex(index));
                        history.push(pageName[index]);
                    }} >
                        {iconComponent}
                        <span style={{ color: color }}>{label[index]}</span>
                    </div>
                })
            }
        </div>
    </div>
}

export default Sidebar;