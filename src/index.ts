import { serve } from '@hono/node-server';
import { config } from 'dotenv';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import app from './app';
import { errorHandler } from './helper/error.handler';
import { logHandler } from './helper/log.handler';
import { notFoundHandler } from './helper/notfound.handler';
import { ENV } from './lib/env';
import { ensureBucket } from './lib/minio';

config();

const index = new Hono();

index.use(
  '*',
  cors({
    origin: ENV.PODS_APP_WHITELIST,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
  }),
);

index.use(secureHeaders());
index.use(logHandler);
index.onError(errorHandler);
index.notFound(notFoundHandler);

index.route('/api/v1', app);

// Initialize MinIO and start server
async function startServer() {
  try {
    // Ensure MinIO bucket exists
    await ensureBucket();
    console.log('✅ MinIO initialized successfully');

    serve(
      {
        fetch: index.fetch,
        port: ENV.PORT,
      },
      (info) => {
        console.log(`🚀 MiniDrive API is running on http://localhost:${info.port}`);
        console.log(`📚 API Documentation: http://localhost:${info.port}/api/v1`);
      },
    );
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
