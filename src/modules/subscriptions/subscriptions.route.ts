import Elysia from 'elysia';
import { getTiers, upgradeTier, getUsage, getSubscriptionHistory } from './subscriptions.service';
import { upgradeTierSchema } from './subscriptions.schema';
import { successResponse, errorResponse } from '../../lib/response';
import { authMiddleware } from '../../middlewares/auth.middleware';

// Public route - no auth required
export const publicSubscriptionsRoute = new Elysia({ prefix: '/subscriptions', tags: ['Subscriptions'] })
  .get('/tiers', async (c) => {
    try {
      const tiers = await getTiers();
      return successResponse({ data: tiers });
    } catch (err) {
      return errorResponse({ message: err instanceof Error ? err.message : 'Failed to get tiers', status: 400 });
    }
  });

// Protected routes - auth required
export const subscriptionsRoute = new Elysia({ prefix: '/subscriptions', tags: ['Subscriptions'] })
  .post('/upgrade', async (c) => {
    try {
      const user = (c as any).get?.('user');
      const body = await c.request.json();
      const parsed = upgradeTierSchema.parse(body);
      const result = await upgradeTier(user.id, parsed.tier as any);
      return successResponse({ message: `Successfully upgraded to ${parsed.tier} tier`, data: result });
    } catch (err) {
      return errorResponse({ message: err instanceof Error ? err.message : 'Failed to upgrade tier', status: 400 });
    }
  })
  .get('/usage', async (c) => {
    try {
      const user = (c as any).get?.('user');
      const usage = await getUsage(user.id);
      return successResponse({ data: usage });
    } catch (err) {
      return errorResponse({ message: err instanceof Error ? err.message : 'Failed to get usage', status: 400 });
    }
  })
  .get('/history', async (c) => {
    try {
      const user = (c as any).get?.('user');
      const history = await getSubscriptionHistory(user.id);
      return successResponse({ data: history });
    } catch (err) {
      return errorResponse({ message: err instanceof Error ? err.message : 'Failed to get history', status: 400 });
    }
  });
