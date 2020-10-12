import React, { createRef } from 'react';
import { connect } from 'react-redux';
import './ReviewPage.css';
import Sidebar from "../components/Sidebar";
import Chart from "../components/Chart";
import Results from "../components/Results";
import Indicators from "../components/Indicators";
import SymbolResults from "../components/SymbolResults";

class ReviewPage extends React.Component {
  render() {
    if (this.props.id == "") {
      this.props.history.push("/");
      return <></>;
    }
    return (
      <div className="review-page">
        <div className="review-page-sidebar">
          <Sidebar history={this.props.history} />
        </div>
        <div className="review-page-backtest-results">
          <Results />
        </div>
        <div className="review-page-data">
          <div className="review-page-chart">
            <Chart />
          </div>
        </div>
        <div className="review-page-query">
          <div className="review-page-indicators">
            <SymbolResults />
          </div>
          <hr></hr>
          <div className="review-page-result">
            <Indicators />
          </div>
        </div>
      </div>
    );
  }
}

let mapStateToProps = (state) => {
  return { id: state.id };
};

export default connect(mapStateToProps)(ReviewPage);