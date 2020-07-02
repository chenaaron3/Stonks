import React from 'react';
import './Hit.css';

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

class Hit extends React.Component {
    colors = ["darkslategray", "darkgreen", "darkred"]
    state = { stage: 0 }

    incStage = () => {
        this.setState({ stage: (this.state.stage + 1) % this.colors.length })
    }

    render() {
        const d = new Date(this.props.value["date"]);
        const ye = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(d);
        const mo = new Intl.DateTimeFormat('en', { month: 'short' }).format(d);
        const da = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(d);

        return <li className="hit-slot" key={this.props.index} style={{ backgroundColor: this.colors[this.state.stage] }} onClick={this.incStage}>
            <div className="hit-header hit-center">
                <div className="hit-icon hit-center">
                    <span>{this.props.symbol}</span>
                </div>
            </div>
            <div className="hit-content">
                    Date: <span className="hit-item">{`${mo} ${da} ${ye}`}</span> <br/>
                    Volume: <span className="hit-item">{numberWithCommas(this.props.value["volume"])}</span> <br/>
                    MACD: <span className="hit-item">{this.props.value["macd"].toFixed(4)}</span> <br/>
            </div>
        </li>
    }
}

export default Hit;
