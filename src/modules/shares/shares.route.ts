import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { authMiddleware } from '../../middlewares/auth.middleware';
import {
    createShare,
    accessShare,
    listShares,
    deleteShare,
    getShareInfo,
} from './shares.service';
import { createShareSchema, accessShareSchema } from './shares.schema';
import { getFileStream } from '../../lib/minio';

const shares = new Hono();

/**
 * POST /shares
 * Create a share link (requires auth)
 */
shares.post('/', authMiddleware, zValidator('json', createShareSchema), async (c) => {
    try {
        const user = c.get('user');
        const { fileId, expiresInHours, maxDownloads } = c.req.valid('json');

        const result = await createShare({
            fileId,
            userId: user.id,
            expiresInHours,
            maxDownloads,
        });

        return c.json({
            success: true,
            data: result,
        });
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create share',
            },
            400,
        );
    }
});

/**
 * GET /shares
 * List user's shares (requires auth)
 */
shares.get('/', authMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const result = await listShares(user.id);

        return c.json({
            success: true,
            data: result,
        });
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to list shares',
            },
            400,
        );
    }
});

/**
 * GET /shares/:token/info
 * Get share information without incrementing download count (public, no auth required)
 */
shares.get('/:token/info', async (c) => {
    try {
        const token = c.req.param('token');
        const result = await getShareInfo(token);

        return c.json({
            success: true,
            data: result,
        });
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get share info',
            },
            400,
        );
    }
});

/**
 * GET /shares/:token
 * Access a shared file (public, no auth required) - streams file directly
 */
shares.get('/:token', async (c) => {
    try {
        const token = c.req.param('token');
        const result = await accessShare(token);

        // Get file stream from MinIO
        const fileStream = await getFileStream(result.objectKey);

        // Set response headers
        c.header('Content-Type', result.mimeType);
        c.header('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
        c.header('Content-Length', result.size.toString());

        // Stream the file directly to the client
        return stream(c, async (stream) => {
            for await (const chunk of fileStream) {
                await stream.write(chunk);
            }
        });
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to access share',
            },
            400,
        );
    }
});

/**
 * DELETE /shares/:id
 * Delete a share link (requires auth)
 */
shares.delete('/:id', authMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const shareId = c.req.param('id');

        await deleteShare(shareId, user.id);

        return c.json({
            success: true,
            message: 'Share deleted successfully',
        });
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to delete share',
            },
            400,
        );
    }
});

export default shares;
