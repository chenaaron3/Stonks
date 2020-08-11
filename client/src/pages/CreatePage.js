import React, { createRef } from 'react';
import './CreatePage.css';
import SavedResults from '../components/SavedResults';
import CreateBacktest from '../components/CreateBacktest';

class CreatePage extends React.Component {

    render() {
        return (
            <div className="create-page">
                <div className="create-page-recents">
                    <SavedResults history={this.props.history} />
                </div>
                <div className="create-page-new">
                    <CreateBacktest history={this.props.history} />
                </div>
            </div>
        );
    }
}

export default CreatePage;
