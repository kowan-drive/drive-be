import { cors } from '@elysiajs/cors';
import { fromTypes, openapi } from '@elysiajs/openapi';
import { Elysia } from 'elysia';
import { App } from './app';
import { AppError } from './common/error';
import { ENV } from './lib/env';
import { errorResponse } from './lib/response';

const app = new Elysia()
  .use(openapi({
    path: '/api/docs',
    references: fromTypes()
  }))
  .use(
    cors({ origin: ENV.PODS_APP_WHITELIST, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], credentials: true, allowedHeaders: ['Content-Type', 'Authorization'] }),
  )
  .onError(({ error, code }) => {
    if (error instanceof AppError) return error.toResponse();
    if (code === 'NOT_FOUND') return errorResponse({ message: 'Resource not found', status: 404 });
    console.error('Unhandled error:', String(error).slice(0, 1000));
    return errorResponse({ message: String(error), status: 500 });
  })
  .onBeforeHandle(({ request }) => console.log(`[${new Date().toISOString()}] Incoming Request: ${request.method} ${request.url}`))
  .get('/healthcheck', () => ({ message: 'Welcome to MiniDrive API (Elysia)', env: ENV.NODE_ENV }))
  .use(App)
  .listen(ENV.PORT);

console.log(`⚒️  MiniDrive (Elysia) is running at ${app.server?.hostname}:${app.server?.port}`);
