import type { Context } from 'hono';

export async function notFoundHandler(c: Context) {
  return c.json(
    {
      isSuccess: false,
      status: 'error',
      message: 'Route not found',
    },
    404,
  );
}
