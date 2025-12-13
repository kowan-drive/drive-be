import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { quotaMiddleware } from '../../middlewares/quota.middleware';
import {
    uploadFile,
    downloadFile,
    deleteFile,
    listFiles,
    getFileMetadata,
    moveFile,
} from './files.service';
import {
    listFilesSchema,
    deleteFileSchema,
    moveFileSchema,
} from './files.schema';

const files = new Hono();

// All routes require authentication
files.use('*', authMiddleware);

/**
 * POST /files/upload
 * Upload a file with encryption
 */
files.post('/upload', quotaMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const file = c.get('uploadFile') as File;
        const fileSize = c.get('fileSize') as bigint;

        const body = await c.req.parseBody();
        const folderId = body.folderId as string | undefined;
        const encryptedFileKey = body.encryptedFileKey as string | undefined;
        const encryptionIv = body.encryptionIv as string | undefined;

        const result = await uploadFile({
            user,
            file,
            fileSize,
            folderId,
            encryptedFileKey,
            encryptionIv,
        });

        return c.json({
            success: true,
            data: result,
        });
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Upload failed',
            },
            400,
        );
    }
});

/**
 * GET /files
 * List user files
 */
files.get('/', zValidator('query', listFilesSchema), async (c) => {
    try {
        const user = c.get('user');
        const { folderId, page, limit } = c.req.valid('query');

        const result = await listFiles({
            userId: user.id,
            folderId,
            page,
            limit,
        });

        return c.json({
            success: true,
            data: result,
        });
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to list files',
            },
            400,
        );
    }
});

/**
 * GET /files/:id/download
 * Download a file
 */
files.get('/:id/download', async (c) => {
    try {
        const user = c.get('user');
        const fileId = c.req.param('id');

        const { buffer, filename, mimeType } = await downloadFile(fileId, user.id);

        // Set headers for file download
        c.header('Content-Type', mimeType);
        c.header('Content-Disposition', `attachment; filename="${filename}"`);
        c.header('Content-Length', buffer.length.toString());

        return c.body(buffer);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Download failed',
            },
            400,
        );
    }
});

/**
 * GET /files/:id/metadata
 * Get file metadata
 */
files.get('/:id/metadata', async (c) => {
    try {
        const user = c.get('user');
        const fileId = c.req.param('id');

        const metadata = await getFileMetadata(fileId, user.id);

        return c.json({
            success: true,
            data: metadata,
        });
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get metadata',
            },
            400,
        );
    }
});

/**
 * DELETE /files/:id
 * Delete a file
 */
files.delete('/:id', zValidator('param', deleteFileSchema), async (c) => {
    try {
        const user = c.get('user');
        const { id } = c.req.valid('param');

        await deleteFile(id, user.id);

        return c.json({
            success: true,
            message: 'File deleted successfully',
        });
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Delete failed',
            },
            400,
        );
    }
});

/**
 * PUT /files/:id/move
 * Move file to another folder
 */
files.put('/:id/move', zValidator('json', moveFileSchema), async (c) => {
    try {
        const user = c.get('user');
        const { id, folderId } = c.req.valid('json');

        const result = await moveFile(id, user.id, folderId);

        return c.json({
            success: true,
            data: result,
        });
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Move failed',
            },
            400,
        );
    }
});

export default files;
