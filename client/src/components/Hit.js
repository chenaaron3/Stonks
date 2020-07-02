import React from 'react';
import './Hit.css';

class Hit extends React.Component {
    render() {
        const d = new Date(this.props.date);
        const ye = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(d);
        const mo = new Intl.DateTimeFormat('en', { month: 'short' }).format(d);
        const da = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(d);

        return <li className="hit-slot" key={this.props.index}>
            Symbol: <span className="hit-item">{this.props.value}</span><br/>
            Date:  <span className="hit-item">{`${mo} ${da} ${ye}`}</span>
        </li>
    }
}

export default Hit;
