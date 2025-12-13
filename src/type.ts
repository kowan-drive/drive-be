import type { User } from '@prisma/client';
import { Pagination } from './middlewares/pagination.middleware';

/**
 * Extend Hono context with custom variables
 */
declare module 'hono' {
    interface ContextVariableMap {
        user: User;
        sessionToken: string;
        uploadFile: File;
        fileSize: bigint;
        pagination?: Pagination;
    }
}

export {};
