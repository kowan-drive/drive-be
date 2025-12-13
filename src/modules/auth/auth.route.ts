import Elysia from 'elysia';
import { errorResponse, successResponse } from '../../lib/response';
import { loginOptionsSchema, loginVerifySchema, registerOptionsSchema, registerVerifySchema } from './auth.schema';
import {
    generateAuthentication,
    generateRegistration,
    getUserFromSession,
    logout,
    verifyAuthentication,
    verifyRegistration,
} from './auth.service';

export const authRoute = new Elysia({ prefix: '/auth', tags: ['Auth'] })
  .post('/register/options', async ({ body }) => {
    try {
      const parsed = registerOptionsSchema.parse(body);
      const options = await generateRegistration(parsed);
      return successResponse({ data: options });
    } catch (err) {
      return errorResponse({ message: err instanceof Error ? err.message : 'Registration failed', status: 400 });
    }
  })
  .post('/register/verify', async ({ body }) => {
    try {
      const parsed = registerVerifySchema.parse(body);
      const result = await verifyRegistration(parsed as any);
      return successResponse({ data: result });
    } catch (err) {
      return errorResponse({ message: err instanceof Error ? err.message : 'Verification failed', status: 400 });
    }
  })
  .post('/login/options', async ({ body }) => {
    try {
      const parsed = loginOptionsSchema.parse(body);
      const options = await generateAuthentication(parsed);
      return successResponse({ data: options });
    } catch (err) {
      return errorResponse({ message: err instanceof Error ? err.message : 'Login failed', status: 400 });
    }
  })
  .post('/login/verify', async ({ body }) => {
    try {
      const parsed = loginVerifySchema.parse(body);
      const result = await verifyAuthentication(parsed as any);
      return successResponse({ data: result });
    } catch (err) {
      return errorResponse({ message: err instanceof Error ? err.message : 'Authentication failed', status: 400 });
    }
  })
  .post('/logout', async ({ request }) => {
    try {
      const authHeader = request.headers.get('authorization') || '';
      if (!authHeader.startsWith('Bearer ')) return errorResponse({ message: 'Authentication required', status: 401 });
      const token = authHeader.substring(7);
      await logout(token);
      return successResponse({ message: 'Logged out successfully' });
    } catch (err) {
      return errorResponse({ message: err instanceof Error ? err.message : 'Logout failed', status: 400 });
    }
  })
  .get('/me', async ({ request }) => {
    try {
      const authHeader = request.headers.get('authorization') || '';
      if (!authHeader.startsWith('Bearer ')) return errorResponse({ message: 'Authentication required', status: 401 });
      const token = authHeader.substring(7);
      const user = await getUserFromSession(token);
      if (!user) return errorResponse({ message: 'Invalid or expired session', status: 401 });
      return successResponse({ data: { id: user.id, email: user.email, username: user.username, tier: user.tier, storageUsed: user.storageUsed, createdAt: user.createdAt } });
    } catch (err) {
      return errorResponse({ message: err instanceof Error ? err.message : 'Fetch failed', status: 400 });
    }
  });
