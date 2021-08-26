declare global {
    namespace NodeJS {
        /**
         * Define schema for environment variables
         */
        interface ProcessEnv {
            MONGO_DATABASE_URL: string;
            SECRET_KEY: string;
            PUSHER_APP_ID: string;
            PUSHER_KEY: string;
            PUSHER_SECRET: string;
            PUSHER_CLUSTER: string;
            PORT: string;
            NODE_ENV: 'development' | 'production';
            SENDGRID_API_KEY: string;
            APCA_API_KEY_ID: string;
            APCA_API_SECRET_KEY: string;
            DOMAIN: string;
            NUM_THREADS: string;
        }
    }
}

// need to export something to be considered a 'module'
export {}