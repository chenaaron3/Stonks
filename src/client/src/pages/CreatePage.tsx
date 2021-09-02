import React, {  } from 'react';
import './CreatePage.css';
import SavedResults from '../components/SavedResults';
import CreateBacktest from '../components/CreateBacktest';

const CreatePage: React.FC = (props) => {
    return (
        <div className="create-page">
            <div className="create-page-recents">
                <SavedResults />
            </div>
            <div className="create-page-new">
                <CreateBacktest />
            </div>
        </div>
    );
}

export default CreatePage;
