import { cors } from '@elysiajs/cors';
import { fromTypes, openapi } from '@elysiajs/openapi';
import { Elysia } from 'elysia';
import { App } from './app';
import { AppError } from './common/error';
import { ENV } from './lib/env';
import { errorResponse } from './lib/response';

// Configure CORS origins - include development frontend URL and whitelist
const corsOrigins = [
  ...ENV.PODS_APP_WHITELIST,
  ENV.FRONTEND_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].filter((origin, index, self) => self.indexOf(origin) === index);

console.log('CORS Origins:', corsOrigins);

const app = new Elysia()
  .use(
    cors({
      origin: corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposeHeaders: ['Content-Type', 'Authorization'],
    }),
  )
  .onError(({ error, code }) => {
    if (error instanceof AppError) return error.toResponse();
    if (code === 'NOT_FOUND') return errorResponse({ message: 'Resource not found', status: 404 });
    console.error('Unhandled error:', String(error).slice(0, 1000));
    return errorResponse({ message: String(error), status: 500 });
  })
  .onBeforeHandle(({ request }) => {
    const origin = request.headers.get('origin') || 'no origin header'
    console.log(`[${new Date().toISOString()}] Incoming Request: ${request.method} ${request.url}`)
    console.log(`  Origin: ${origin}`)
    console.log(`  Allowed origins:`, corsOrigins)
    console.log(`  Origin allowed:`, corsOrigins.includes(origin))
  })
  .get('/healthcheck', () => ({ message: 'Welcome to MiniDrive API (Elysia)', env: ENV.NODE_ENV }))
  .use(App)
  .listen(ENV.PORT);

console.log(`⚒️  MiniDrive (Elysia) is running at ${app.server?.hostname}:${app.server?.port}`);
