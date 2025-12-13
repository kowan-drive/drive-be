import Elysia from 'elysia';
import { createShare, accessShare, listShares, deleteShare } from './shares.service';
import { createShareSchema } from './shares.schema';
import { successResponse, errorResponse } from '../../lib/response';
import { authMiddleware } from '../../middlewares/auth.middleware';

// Public share access route (no auth required)
export const publicShareRoute = new Elysia({ prefix: '/shares', tags: ['Shares'] })
  .get('/:token', async (c) => {
    try {
      const token = c.params.token;
      const result = await accessShare(token);
      return c.redirect(result.presignedUrl);
    } catch (err) {
      return errorResponse({ message: err instanceof Error ? err.message : 'Failed to access share', status: 400 });
    }
  });

// Protected share routes (auth required - middleware applied in app.ts)
export const sharesRoute = new Elysia({ prefix: '/shares', tags: ['Shares'] })
  .post('/', async (c) => {
    try {
      const user = (c as any).get?.('user');
      const body = await c.request.json();
      const parsed = createShareSchema.parse(body);
      const result = await createShare({ fileId: parsed.fileId, userId: user.id, expiresInHours: parsed.expiresInHours, maxDownloads: parsed.maxDownloads });
      return successResponse({ data: result });
    } catch (err) {
      return errorResponse({ message: err instanceof Error ? err.message : 'Failed to create share', status: 400 });
    }
  })
  .get('/', async (c) => {
    try {
      const user = (c as any).get?.('user');
      const result = await listShares(user.id);
      return successResponse({ data: result });
    } catch (err) {
      return errorResponse({ message: err instanceof Error ? err.message : 'Failed to list shares', status: 400 });
    }
  })
  .delete('/:id', async (c) => {
    try {
      const user = (c as any).get?.('user');
      const id = c.params.id;
      await deleteShare(id, user.id);
      return successResponse({ message: 'Share deleted successfully' });
    } catch (err) {
      return errorResponse({ message: err instanceof Error ? err.message : 'Failed to delete share', status: 400 });
    }
  });
