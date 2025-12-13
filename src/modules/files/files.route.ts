import Elysia from 'elysia';
import { quotaMiddleware } from '../../middlewares/quota.middleware';
import { paginationMiddleware } from '../../middlewares/pagination.middleware';
import { uploadFile, downloadFile, deleteFile, listFiles, getFileMetadata, moveFile } from './files.service';
import { listFilesSchema, deleteFileSchema, moveFileSchema } from './files.schema';
import { successResponse, errorResponse } from '../../lib/response';

export const filesRoute = new Elysia({ prefix: '/files', tags: ['Files'] })
  .use(async (app) => app) // placeholder to allow middleware chaining
  .post('/upload', { handler: async (c) => {
    try {
      const user = (c as any).get?.('user');
      const file = (c as any).get?.('uploadFile');
      const fileSize = (c as any).get?.('fileSize');

      const body = await c.request.formData();
      const folderId = body.get('folderId') as string | undefined;

      const result = await uploadFile({ user, file, fileSize, folderId });
      return successResponse({ data: result });
    } catch (error) {
      return errorResponse({ message: error instanceof Error ? error.message : 'Upload failed', status: 400 });
    }
  }, middleware: [quotaMiddleware()] })
  .get('/', { handler: async (c) => {
    try {
      const user = (c as any).get?.('user');
      const url = new URL(c.request.url);
      const folderId = url.searchParams.get('folderId') || undefined;
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');

      const result = await listFiles({ userId: user.id, folderId, page, limit });
      return successResponse({ data: result });
    } catch (error) {
      return errorResponse({ message: error instanceof Error ? error.message : 'Failed to list files', status: 400 });
    }
  }, options: { query: listFilesSchema } })
  .get('/:id/download', async (c) => {
    try {
      const user = (c as any).get?.('user');
      const id = (c as any).params.id;
      const { buffer, filename, mimeType } = await downloadFile(id, user.id);

      c.response.headers.set('Content-Type', mimeType);
      c.response.headers.set('Content-Disposition', `attachment; filename="${filename}"`);
      c.response.headers.set('Content-Length', buffer.length.toString());

      return c.body(buffer);
    } catch (error) {
      return errorResponse({ message: error instanceof Error ? error.message : 'Download failed', status: 400 });
    }
  })
  .get('/:id/metadata', async (c) => {
    try {
      const user = (c as any).get?.('user');
      const id = (c as any).params.id;
      const metadata = await getFileMetadata(id, user.id);
      return successResponse({ data: metadata });
    } catch (error) {
      return errorResponse({ message: error instanceof Error ? error.message : 'Failed to get metadata', status: 400 });
    }
  })
  .delete('/:id', { handler: async (c) => {
    try {
      const user = (c as any).get?.('user');
      const id = (c as any).params.id;
      await deleteFile(id, user.id);
      return successResponse({ message: 'File deleted successfully' });
    } catch (error) {
      return errorResponse({ message: error instanceof Error ? error.message : 'Delete failed', status: 400 });
    }
  }, options: { params: deleteFileSchema } })
  .put('/:id/move', { handler: async (c) => {
    try {
      const user = (c as any).get?.('user');
      const body = await c.request.json();
      const { id, folderId } = body as any;
      const result = await moveFile(id, user.id, folderId);
      return successResponse({ data: result });
    } catch (error) {
      return errorResponse({ message: error instanceof Error ? error.message : 'Move failed', status: 400 });
    }
  }, options: { body: moveFileSchema } });
