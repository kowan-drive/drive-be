import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { authMiddleware } from '../../middlewares/auth.middleware';
import {
    getTiers,
    upgradeTier,
    getUsage,
    getSubscriptionHistory,
} from './subscriptions.service';
import { upgradeTierSchema } from './subscriptions.schema';

const subscriptions = new Hono();

// All routes require authentication
subscriptions.use('*', authMiddleware);

/**
 * GET /subscriptions/tiers
 * Get available subscription tiers
 */
subscriptions.get('/tiers', async (c) => {
    try {
        const tiers = await getTiers();

        return c.json({
            success: true,
            data: tiers,
        });
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get tiers',
            },
            400,
        );
    }
});

/**
 * POST /subscriptions/upgrade
 * Upgrade user's subscription tier
 */
subscriptions.post('/upgrade', zValidator('json', upgradeTierSchema), async (c) => {
    try {
        const user = c.get('user');
        const { tier } = c.req.valid('json');

        const result = await upgradeTier(user.id, tier);

        return c.json({
            success: true,
            message: `Successfully upgraded to ${tier} tier`,
            data: result,
        });
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to upgrade tier',
            },
            400,
        );
    }
});

/**
 * GET /subscriptions/usage
 * Get current storage usage
 */
subscriptions.get('/usage', async (c) => {
    try {
        const user = c.get('user');
        const usage = await getUsage(user.id);

        return c.json({
            success: true,
            data: usage,
        });
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get usage',
            },
            400,
        );
    }
});

/**
 * GET /subscriptions/history
 * Get subscription history
 */
subscriptions.get('/history', async (c) => {
    try {
        const user = c.get('user');
        const history = await getSubscriptionHistory(user.id);

        return c.json({
            success: true,
            data: history,
        });
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get history',
            },
            400,
        );
    }
});

export default subscriptions;
