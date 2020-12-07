import React, { createRef } from 'react';
import './CreatePage.css';
import SavedResults from '../components/SavedResults';
import CreateBacktest from '../components/CreateBacktest';

class CreatePage extends React.Component {

    render() {
        return (
            <div className="create-page">
                <div className="create-page-recents">
                    <SavedResults {...this.props} />
                </div>
                <div className="create-page-new">
                    <CreateBacktest {...this.props} />
                </div>
            </div>
        );
    }
}

export default CreatePage;
