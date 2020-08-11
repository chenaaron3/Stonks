import React, { createRef } from 'react';
import { connect } from 'react-redux';
import './ReviewPage.css';
import Chart from "../components/Chart";
import Results from "../components/Results";
import Indicators from "../components/Indicators";

class ReviewPage extends React.Component {
  render() {
    if (this.props.id == "") {
      this.props.history.push("/");
      return <></>;
    }
    return (
      <div className="review-page">
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
          </div>
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