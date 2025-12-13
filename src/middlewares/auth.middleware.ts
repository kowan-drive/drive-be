import type { Context } from 'elysia';
import { errorResponse } from '../lib/response';
import { getUserFromSession } from '../modules/auth/auth.service';

export function authMiddleware() {
  return async (c: Context, next: () => Promise<void>) => {
    const authHeader = c.request.headers.get('authorization') || '';

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse({ message: 'Authentication required', status: 401 });
    }

    const token = authHeader.substring(7);

    try {
      const user = await getUserFromSession(token);

      if (!user) {
        return errorResponse({ message: 'Invalid or expired session', status: 401 });
      }

      // Ensure context has set/get helpers (fallbacks) and attach both structured and direct fields
      if (!(c as any).set) {
        (c as any).set = (key: string, val: any) => {
          (c as any)[key] = val;
        };
      }

      if (!(c as any).get) {
        (c as any).get = (key: string) => (c as any)[key];
      }

      (c as any).set('user', user);
      (c as any).set('sessionToken', token);
      (c as any).user = user;
      (c as any).sessionToken = token;

      await next();
    } catch (err) {
      return errorResponse({ message: 'Authentication failed', status: 401 });
    }
  };
}
