import React, { createRef } from 'react';
import { connect } from 'react-redux';
import { setPageIndex } from '../redux';
import "./Sidebar.css";
import HomeIcon from '@material-ui/icons/Home';
import EqualizerIcon from '@material-ui/icons/Equalizer';
import SearchIcon from '@material-ui/icons/Search';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import WatchLaterOutlinedIcon from '@material-ui/icons/WatchLaterOutlined';

let pageName = ["/", "/summary", "/review", "/simulate", "/watchlist"];
let icons = [HomeIcon, EqualizerIcon, SearchIcon, PlayArrowIcon, WatchLaterOutlinedIcon];
let label = ["Home", "Summary", "Review", "Simulate", "Watchlist"]

class Sidebar extends React.Component {
    render() {
        return <div className="sidebar">
            <div className="sidebar-icon-list">
                {
                    icons.map((icon, index) => {
                        let color = index == this.props.pageIndex ? "#2ecc71" : "";
                        let IconClass = icon;
                        let iconComponent = <IconClass fontSize="large" style={{ color: color }} />;
                        return <div className="sidebar-icon-wrapper" onClick={() => {
                            this.props.setPageIndex(index);
                            this.props.history.push(pageName[index]);
                        }} >
                            {iconComponent}
                            <span style={{ color: color }}>{label[index]}</span>
                        </div>
                    })
                }
            </div>
        </div>
    }
}

let mapStateToProps = (state) => {
    return { pageIndex: state.pageIndex };
};


export default connect(mapStateToProps, { setPageIndex })(Sidebar);