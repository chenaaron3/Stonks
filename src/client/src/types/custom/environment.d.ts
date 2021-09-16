declare global {
    namespace NodeJS {
        /**
         * Define schema for environment variables
         */
        interface ProcessEnv {
            REACT_APP_SUBDIRECTORY: string;
            REACT_APP_DOMAIN: string;
            REACT_APP_DEMO_ID: string;

        }
    }
}

// need to export something to be considered a 'module'
export {}