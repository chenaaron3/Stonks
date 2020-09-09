import React, { createRef } from 'react';
import "./Sidebar.css";

import summaryIcon from "../summary.svg";
import reviewIcon from "../review.svg";
import simulateIcon from "../simulate.svg";
import watchlistIcon from "../watchlist.svg";

let pageName = ["/summary", "/review", "/simulate", "/watchlist"];
let icons = [summaryIcon, reviewIcon, simulateIcon, watchlistIcon];

class Sidebar extends React.Component {
    render() {
        return <div className="sidebar">
            <div className="sidebar-icon-list">
                {
                    icons.map((icon, index) => {
                        return <div className="sidebar-icon-wrapper">
                            <img className={`sidebar-icon`} key={`sidebar-${index}`} width="25px" height="25px" src={icon} onClick={() => {
                                this.props.history.push(pageName[index]);
                            }} />
                        </div>
                    })
                }
            </div>
        </div>
    }
}

export default Sidebar;