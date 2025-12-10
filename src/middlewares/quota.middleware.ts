import type { Context, Next } from 'hono';
import { getQuotaLimit } from '../lib/encryption';

/**
 * Quota validation middleware
 * Checks if user has enough storage quota before file upload
 */
export async function quotaMiddleware(c: Context, next: Next) {
    const user = c.get('user');

    if (!user) {
        return c.json(
            {
                success: false,
                error: 'User not authenticated',
            },
            401,
        );
    }

    // Get file size from request (assuming multipart form data)
    const body = await c.req.parseBody();
    const file = body['file'];

    if (!file || !(file instanceof File)) {
        return c.json(
            {
                success: false,
                error: 'No file provided',
            },
            400,
        );
    }

    const fileSize = BigInt(file.size);
    const quotaLimit = getQuotaLimit(user.tier as 'FREE' | 'PRO' | 'PREMIUM');
    const newTotalUsage = user.storageUsed + fileSize;

    if (newTotalUsage > quotaLimit) {
        return c.json(
            {
                success: false,
                error: 'Storage quota exceeded',
                details: {
                    currentUsage: user.storageUsed.toString(),
                    quotaLimit: quotaLimit.toString(),
                    attemptedSize: fileSize.toString(),
                },
            },
            403,
        );
    }

    // Store file for later use in the route handler
    c.set('uploadFile', file);
    c.set('fileSize', fileSize);

    await next();
}
