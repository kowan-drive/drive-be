import Elysia from 'elysia';
import { ensureBucket } from './lib/minio';
import { authMiddleware } from './middlewares/auth.middleware';
import { authRoute } from './modules/auth/auth.route';
import { filesRoute } from './modules/files/files.route';
import { foldersRoute } from './modules/folders/folders.route';
import { sharesRoute, publicShareRoute } from './modules/shares/shares.route';
import { subscriptionsRoute, publicSubscriptionsRoute } from './modules/subscriptions/subscriptions.route';

export const App = new Elysia({ tags: ['API'], prefix: '/api/v1' })
  .use(async (app) => {
    // ensure minio bucket on startup
    await ensureBucket();
    return app;
  })
  .use(authRoute)
  // Public routes (no auth required)
  .use(publicShareRoute)
  .use(publicSubscriptionsRoute)
  .use(authMiddleware)
  .use(filesRoute)
  .use(foldersRoute)
  .use(sharesRoute)
  .use(subscriptionsRoute);
