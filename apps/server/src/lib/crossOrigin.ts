import type { NextFunction, Request, Response } from 'express';
import { env } from './env.js';
import { timingSafeEqual } from './utils.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** The visitor's IP, looked through our own Cloudflare proxy when it vouches for it. */
      clientIp?: string;
    }
  }
}

const DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:8787'];

/** `https://*.brahmastra.studio` matches any depth of subdomain, never the bare domain. */
function toMatcher(entry: string): (origin: string) => boolean {
  const wildcard = /^(https?):\/\/\*\.(.+)$/.exec(entry);
  if (!wildcard) return origin => origin === entry;

  const [, scheme, domain] = wildcard;
  const pattern = new RegExp(
    `^${scheme}://([a-z0-9-]+\\.)+${domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
    'i'
  );
  return origin => pattern.test(origin);
}

const matchers = [
  ...env.allowedOrigins,
  new URL(env.appUrl).origin,
  ...(env.production ? [] : DEV_ORIGINS)
].map(toMatcher);

export const originAllowed = (origin: string) => matchers.some(matches => matches(origin));

/**
 * Credentialed CORS for the brahmastra.studio family. Only listed origins get the
 * headers back, so any other site can still send a request but can never read the
 * answer — and writes stay behind the CSRF pair regardless.
 */
export function crossOrigin(req: Request, res: Response, next: NextFunction) {
  const origin = req.get('Origin');
  if (origin && originAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.append('Vary', 'Origin');

    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-CSRF-Token');
      res.setHeader('Access-Control-Max-Age', '600');
      return res.status(204).end();
    }
  }
  next();
}

/**
 * Requests arrive via Cloudflare → our Worker → Render's load balancer, so `req.ip` is a
 * Cloudflare egress address shared by thousands of visitors. The Worker forwards the real
 * address and proves it is the Worker with a shared secret; without that proof the
 * header is ignored, so nobody can spoof their way around the rate limits.
 */
export function clientIp(req: Request, _res: Response, next: NextFunction) {
  const proof = req.get('X-Academy-Proxy');
  const forwarded = req.get('X-Forwarded-For')?.split(',')[0]?.trim();

  req.clientIp =
    env.proxySecret && proof && forwarded && timingSafeEqual(proof, env.proxySecret)
      ? forwarded
      : req.ip;
  next();
}
