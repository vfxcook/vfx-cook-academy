import { existsSync } from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express from 'express';
import { attachUser, validateCsrf } from './lib/auth.js';
import { clientIp, crossOrigin } from './lib/crossOrigin.js';
import { env } from './lib/env.js';
import { errorHandler, notFound } from './lib/http.js';
import { databaseFailureCode, prisma } from './lib/prisma.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { commentsRouter } from './routes/comments.js';
import { communityRouter } from './routes/community.js';
import { coursesRouter } from './routes/courses.js';
import { notificationsRouter } from './routes/notifications.js';
import { paymentsRouter, razorpayWebhook } from './routes/payments.js';
import { studioRouter } from './routes/studio.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  });

  // Signed over the exact bytes, so this must sit ahead of the JSON parser.
  app.post('/api/payments/razorpay-webhook', express.raw({ type: '*/*' }), razorpayWebhook);

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.get('/healthz', (_req, res) => res.json({ ok: true }));
  app.get('/readyz', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, database: 'up' });
    } catch (error) {
      // The code says what is wrong from outside the host — nobody has to read the logs
      // to tell a wrong password from an unreachable server. The message, which names the
      // host, is logged rather than returned.
      console.error('[academy] database check failed:', error instanceof Error ? error.message : error);
      res.status(503).json({ ok: false, database: 'down', code: databaseFailureCode(error) });
    }
  });

  if (!env.supabase.enabled) {
    app.use('/uploads', express.static(env.uploadsDir, { maxAge: '365d', immutable: true }));
  }

  const api = express.Router();
  // CORS answers preflights before anything else looks at the request.
  api.use(crossOrigin);
  api.use(clientIp);
  api.use(attachUser);
  api.use(validateCsrf);

  api.use('/auth', authRouter);
  api.use('/courses', coursesRouter);
  api.use('/comments', commentsRouter);
  api.use('/community', communityRouter);
  api.use('/notifications', notificationsRouter);
  api.use('/payments', paymentsRouter);
  api.use('/studio', studioRouter);
  api.use('/admin', adminRouter);
  api.use((_req, _res, next) => next(notFound('No such endpoint.')));

  app.use('/api', api);

  // Single-origin production: serve the built client and let the SPA own routing.
  const webDist = env.webDist || path.resolve(process.cwd(), '..', 'web', 'dist');
  if (existsSync(webDist)) {
    app.use(express.static(webDist, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
