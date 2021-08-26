import { Request, Response } from 'express';

export interface AutoUpdateRequest extends Request {
    body: {
        id: string;
        subscribe: boolean;
    }
}