import Elysia from 'elysia';
import { createFolder, listFolders, updateFolder, deleteFolder } from './folders.service';
import { createFolderSchema, updateFolderSchema, deleteFolderSchema, listFoldersSchema } from './folders.schema';
import { successResponse, errorResponse } from '../../lib/response';

export const foldersRoute = new Elysia({ prefix: '/folders', tags: ['Folders'] })
  .post('/', async (c) => {
    try {
      const user = (c as any).get?.('user');
      const body = await c.request.json();
      const parsed = createFolderSchema.parse(body);
      const result = await createFolder({ name: parsed.name, parentId: parsed.parentId, ownerId: user.id });
      return successResponse({ data: result });
    } catch (err) {
      return errorResponse({ message: err instanceof Error ? err.message : 'Failed to create folder', status: 400 });
    }
  })
  .get('/', async (c) => {
    try {
      const user = (c as any).get?.('user');
      const url = new URL(c.request.url);
      const parentId = url.searchParams.get('parentId') || undefined;
      const result = await listFolders(user.id, parentId);
      return successResponse({ data: result });
    } catch (err) {
      return errorResponse({ message: err instanceof Error ? err.message : 'Failed to list folders', status: 400 });
    }
  })
  .put('/:id', async (c) => {
    try {
      const user = (c as any).get?.('user');
      const body = await c.request.json();
      const parsed = updateFolderSchema.parse({ id: c.param('id'), ...body });
      const result = await updateFolder({ id: parsed.id, name: parsed.name, ownerId: user.id });
      return successResponse({ data: result });
    } catch (err) {
      return errorResponse({ message: err instanceof Error ? err.message : 'Failed to update folder', status: 400 });
    }
  })
  .delete('/:id', async (c) => {
    try {
      const user = (c as any).get?.('user');
      const id = c.param('id');
      deleteFolderSchema.parse({ id });
      const result = await deleteFolder(id, user.id);
      return successResponse({ message: 'Folder deleted successfully', data: result });
    } catch (err) {
      return errorResponse({ message: err instanceof Error ? err.message : 'Failed to delete folder', status: 400 });
    }
  });
