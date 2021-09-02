import { PassportUserData } from '@shared/common';

declare global {
    namespace Express {
        // req.user
        interface Request {
            user?: PassportUserData;
        }
    }
}

export { }