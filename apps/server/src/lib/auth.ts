import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from './env.js';
import { forbidden, unauthorized } from './http.js';
import { prisma } from './prisma.js';

export const SESSION_COOKIE = 'academy_session';
export const CSRF_COOKIE = 'academy_csrf';

export type SessionUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  phone: string | null;
  role: 'STUDENT' | 'ADMIN';
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

/** Tokens are stored hashed, so a database leak cannot be replayed as a session. */
const digest = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
const newToken = () => crypto.randomBytes(32).toString('base64url');

function secureCookies(req: Request) {
  return env.production && (req.secure || req.get('x-forwarded-proto') === 'https');
}

/**
 * `COOKIE_DOMAIN=.brahmastra.studio` shares the session across every subdomain — but a
 * browser only accepts a Domain the page it is on actually sits under. Sent from a
 * workers.dev preview or localhost, that cookie is dropped on the floor: sign-in appears
 * to do nothing, because the session was created and then never stored. So the domain is
 * attached only where it is allowed, and everywhere else the cookie is host-only.
 */
function cookieScope(req: Request) {
  const domain = env.cookieDomain;
  if (!domain) return { path: '/' };

  const host = (req.get('x-forwarded-host') ?? req.hostname ?? '').split(':')[0].toLowerCase();
  const root = domain.replace(/^\./, '');
  const inside = host === root || host.endsWith(`.${root}`);
  return inside ? { path: '/', domain } : { path: '/' };
}

export async function createSession(req: Request, res: Response, userId: string) {
  const token = newToken();
  const maxAge = env.sessionDays * 864e5;
  const expires = new Date(Date.now() + maxAge);

  await prisma.session.create({
    data: { sessionToken: digest(token), userId, expires }
  });

  const secure = secureCookies(req);
  const scope = cookieScope(req);
  res.cookie(SESSION_COOKIE, token, { ...scope, httpOnly: true, sameSite: 'lax', secure, maxAge });
  res.cookie(CSRF_COOKIE, newToken(), { ...scope, httpOnly: false, sameSite: 'lax', secure, maxAge });
}

export async function destroySession(req: Request, res: Response) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) {
    await prisma.session.deleteMany({ where: { sessionToken: digest(token) } });
  }
  const scope = cookieScope(req);
  res.clearCookie(SESSION_COOKIE, scope);
  res.clearCookie(CSRF_COOKIE, scope);
}

export async function userFromRequest(req: Request): Promise<SessionUser | null> {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { sessionToken: digest(token) },
    include: {
      user: {
        select: { id: true, name: true, email: true, image: true, phone: true, role: true }
      }
    }
  });

  if (!session || session.expires < new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return session.user as SessionUser;
}

/** Populates req.user when a valid session cookie is present; never rejects. */
export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const user = await userFromRequest(req);
    if (user) req.user = user;
  } catch (error) {
    console.error('[academy] session lookup failed', error);
  }
  next();
}

export function requireUser(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'ADMIN') return next(forbidden('Admin access required.'));
  next();
}

/**
 * Double-submit CSRF. A request carrying a session cookie must also carry the
 * matching token pair; tokenless callers with no session (webhooks) pass through.
 */
export function validateCsrf(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get('X-CSRF-Token');

  if (!cookieToken && !headerToken) {
    return req.cookies?.[SESSION_COOKIE]
      ? next(forbidden('CSRF token missing. Please refresh and try again.'))
      : next();
  }
  if (!cookieToken) return next(forbidden('CSRF cookie missing. Please refresh and try again.'));
  if (!headerToken) return next(forbidden('CSRF token header missing.'));
  if (cookieToken !== headerToken) return next(forbidden('CSRF token mismatch.'));
  next();
}
