import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import {
    generateRegistration,
    verifyRegistration,
    generateAuthentication,
    verifyAuthentication,
    logout,
} from './auth.service';
import {
    registerOptionsSchema,
    registerVerifySchema,
    loginOptionsSchema,
    loginVerifySchema,
} from './auth.schema';
import { authMiddleware } from '../../middlewares/auth.middleware';

const auth = new Hono();

/**
 * POST /auth/register/options
 * Generate WebAuthn registration challenge
 */
auth.post('/register/options', zValidator('json', registerOptionsSchema), async (c) => {
    try {
        const { email, username } = c.req.valid('json');
        const options = await generateRegistration({ email, username });

        return c.json({
            success: true,
            data: options,
        });
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Registration failed',
            },
            400,
        );
    }
});

/**
 * POST /auth/register/verify
 * Verify WebAuthn registration response
 */
auth.post('/register/verify', zValidator('json', registerVerifySchema), async (c) => {
    try {
        const body = c.req.valid('json');
        const result = await verifyRegistration(body);

        return c.json({
            success: true,
            data: result,
        });
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Verification failed',
            },
            400,
        );
    }
});

/**
 * POST /auth/login/options
 * Generate WebAuthn authentication challenge
 */
auth.post('/login/options', zValidator('json', loginOptionsSchema), async (c) => {
    try {
        const { email } = c.req.valid('json');
        const options = await generateAuthentication({ email });

        return c.json({
            success: true,
            data: options,
        });
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Login failed',
            },
            400,
        );
    }
});

/**
 * POST /auth/login/verify
 * Verify WebAuthn authentication response
 */
auth.post('/login/verify', zValidator('json', loginVerifySchema), async (c) => {
    try {
        const body = c.req.valid('json');
        const result = await verifyAuthentication(body);

        return c.json({
            success: true,
            data: result,
        });
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Authentication failed',
            },
            400,
        );
    }
});

/**
 * POST /auth/logout
 * End user session
 */
auth.post('/logout', authMiddleware, async (c) => {
    try {
        const sessionToken = c.get('sessionToken');
        await logout(sessionToken);

        return c.json({
            success: true,
            message: 'Logged out successfully',
        });
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Logout failed',
            },
            400,
        );
    }
});

/**
 * GET /auth/me
 * Get current authenticated user
 */
auth.get('/me', authMiddleware, async (c) => {
    const user = c.get('user');

    return c.json({
        success: true,
        data: {
            id: user.id,
            email: user.email,
            username: user.username,
            tier: user.tier,
            storageUsed: user.storageUsed,
            createdAt: user.createdAt,
        },
    });
});

export default auth;
