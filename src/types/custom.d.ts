declare global {
    namespace Express {
        // req.user
        interface Request {
            user?: {
                username: string
            }
        }
    }
}

export {}