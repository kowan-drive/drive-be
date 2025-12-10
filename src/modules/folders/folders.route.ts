import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { authMiddleware } from '../../middlewares/auth.middleware';
import {
    createFolder,
    listFolders,
    updateFolder,
    deleteFolder,
} from './folders.service';
import {
    createFolderSchema,
    updateFolderSchema,
    deleteFolderSchema,
    listFoldersSchema,
} from './folders.schema';

const folders = new Hono();

// All routes require authentication
folders.use('*', authMiddleware);

/**
 * POST /folders
 * Create a new folder
 */
folders.post('/', zValidator('json', createFolderSchema), async (c) => {
    try {
        const user = c.get('user');
        const { name, parentId } = c.req.valid('json');

        const result = await createFolder({
            name,
            parentId,
            ownerId: user.id,
        });

        return c.json({
            success: true,
            data: result,
        });
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create folder',
            },
            400,
        );
    }
});

/**
 * GET /folders
 * List folders
 */
folders.get('/', zValidator('query', listFoldersSchema), async (c) => {
    try {
        const user = c.get('user');
        const { parentId } = c.req.valid('query');

        const result = await listFolders(user.id, parentId);

        return c.json({
            success: true,
            data: result,
        });
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to list folders',
            },
            400,
        );
    }
});

/**
 * PUT /folders/:id
 * Update folder name
 */
folders.put('/:id', zValidator('json', updateFolderSchema), async (c) => {
    try {
        const user = c.get('user');
        const { id, name } = c.req.valid('json');

        const result = await updateFolder({
            id,
            name,
            ownerId: user.id,
        });

        return c.json({
            success: true,
            data: result,
        });
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update folder',
            },
            400,
        );
    }
});

/**
 * DELETE /folders/:id
 * Delete folder and all contents
 */
folders.delete('/:id', zValidator('param', deleteFolderSchema), async (c) => {
    try {
        const user = c.get('user');
        const { id } = c.req.valid('param');

        const result = await deleteFolder(id, user.id);

        return c.json({
            success: true,
            message: 'Folder deleted successfully',
            data: result,
        });
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to delete folder',
            },
            400,
        );
    }
});

export default folders;
