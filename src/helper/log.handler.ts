import type { Context, Next } from 'hono';

export async function logHandler(c: Context, next: Next) {
  const start = Date.now();

  await next();

  const ms = Date.now() - start;
  const { method, path } = c.req;
  const status = c.res.status;

  if (status >= 400) {
    console.error(`[${new Date().toISOString()}] ${method} ${path} - ${status} (${ms}ms)`);
  }

  console.log(`[${new Date().toISOString()}] ${method} ${path} - ${status} (${ms}ms)`);
}
