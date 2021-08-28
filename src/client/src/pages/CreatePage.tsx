import React, { createRef } from 'react';
import './CreatePage.css';
import SavedResults from '../components/SavedResults';
import CreateBacktest from '../components/CreateBacktest';

import { BacktestPageProps } from '../types/types';

const CreatePage: React.FC<BacktestPageProps> = (props) => {
    return (
        <div className="create-page">
            <div className="create-page-recents">
                <SavedResults {...props} />
            </div>
            <div className="create-page-new">
                <CreateBacktest {...props} />
            </div>
        </div>
    );
}

export default CreatePage;
