import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './http.js';

/**
 * Fixed-window limiter keyed by client IP. In-memory, so on serverless it is per
 * instance — enough to blunt password spraying and gift/license code guessing, not a
 * substitute for an edge WAF.
 */
export function rateLimit(options: { name: string; windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${options.name}:${req.ip ?? 'unknown'}`;

    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + options.windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    if (hits.size > 10_000) {
      for (const [id, value] of hits) if (value.resetAt <= now) hits.delete(id);
    }

    if (entry.count > options.max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return next(new ApiError(429, 'Too many attempts. Wait a minute and try again.', 'RATE_LIMITED'));
    }
    next();
  };
}
