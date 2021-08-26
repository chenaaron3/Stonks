import React from 'react';
import MainLayout from "../layouts/MainLayout";
import Account from "../components/Account";

class AccountPage extends React.Component {
    render() {
        return <MainLayout {...this.props}>
            <Account />
        </MainLayout>
    }
}

export default AccountPage;