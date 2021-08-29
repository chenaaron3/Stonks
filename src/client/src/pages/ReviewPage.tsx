import React, {  } from 'react';
import './ReviewPage.css';
import MainLayout from "../layouts/MainLayout";
import Chart from "../components/Chart";
import Results from "../components/Results";
import Indicators from "../components/Indicators";
import SymbolResults from "../components/SymbolResults";

class ReviewPage extends React.Component {
  render() {
    return <MainLayout >
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
          <div className="review-page-result">
            <SymbolResults />
          </div>
          <hr></hr>
          <div className="review-page-indicators">
            <Indicators />
          </div>
        </div>
      </div>
    </MainLayout>
  }
}

export default ReviewPage;