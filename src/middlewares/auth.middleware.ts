import type { Context, Next } from 'hono';
import { getUserFromSession } from '../modules/auth/auth.service';

/**
 * Authentication middleware
 * Validates session token and attaches user to context
 */
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(
      {
        success: false,
        error: 'Authentication required',
      },
      401,
    );
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    const user = await getUserFromSession(token);

    if (!user) {
      return c.json(
        {
          success: false,
          error: 'Invalid or expired session',
        },
        401,
      );
    }

    // Attach user and session token to context
    c.set('user', user);
    c.set('sessionToken', token);

    await next();
  } catch (error) {
    return c.json(
      {
        success: false,
        error: 'Authentication failed',
      },
      401,
    );
  }
}
