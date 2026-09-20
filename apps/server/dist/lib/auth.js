import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from './env.js';
import { forbidden, unauthorized } from './http.js';
import { prisma } from './prisma.js';
export const SESSION_COOKIE = 'academy_session';
export const CSRF_COOKIE = 'academy_csrf';
const SALT_ROUNDS = 10;
export const hashPassword = (plain) => bcrypt.hash(plain, SALT_ROUNDS);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);
/** Tokens are stored hashed, so a database leak cannot be replayed as a session. */
const digest = (token) => crypto.createHash('sha256').update(token).digest('hex');
const newToken = () => crypto.randomBytes(32).toString('base64url');
function secureCookies(req) {
    return env.production && (req.secure || req.get('x-forwarded-proto') === 'https');
}
export async function createSession(req, res, userId) {
    const token = newToken();
    const maxAge = env.sessionDays * 864e5;
    const expires = new Date(Date.now() + maxAge);
    await prisma.session.create({
        data: { sessionToken: digest(token), userId, expires }
    });
    const secure = secureCookies(req);
    res.cookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure,
        maxAge,
        path: '/'
    });
    res.cookie(CSRF_COOKIE, newToken(), {
        httpOnly: false,
        sameSite: 'lax',
        secure,
        maxAge,
        path: '/'
    });
}
export async function destroySession(req, res) {
    const token = req.cookies?.[SESSION_COOKIE];
    if (token) {
        await prisma.session.deleteMany({ where: { sessionToken: digest(token) } });
    }
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.clearCookie(CSRF_COOKIE, { path: '/' });
}
export async function userFromRequest(req) {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token)
        return null;
    const session = await prisma.session.findUnique({
        where: { sessionToken: digest(token) },
        include: {
            user: {
                select: { id: true, name: true, email: true, image: true, phone: true, role: true }
            }
        }
    });
    if (!session || session.expires < new Date()) {
        if (session)
            await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
        return null;
    }
    return session.user;
}
/** Populates req.user when a valid session cookie is present; never rejects. */
export async function attachUser(req, _res, next) {
    try {
        const user = await userFromRequest(req);
        if (user)
            req.user = user;
    }
    catch (error) {
        console.error('[academy] session lookup failed', error);
    }
    next();
}
export function requireUser(req, _res, next) {
    if (!req.user)
        return next(unauthorized());
    next();
}
export function requireAdmin(req, _res, next) {
    if (!req.user)
        return next(unauthorized());
    if (req.user.role !== 'ADMIN')
        return next(forbidden('Admin access required.'));
    next();
}
/**
 * Double-submit CSRF. A request carrying a session cookie must also carry the
 * matching token pair; tokenless callers with no session (webhooks) pass through.
 */
export function validateCsrf(req, _res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method))
        return next();
    const cookieToken = req.cookies?.[CSRF_COOKIE];
    const headerToken = req.get('X-CSRF-Token');
    if (!cookieToken && !headerToken) {
        return req.cookies?.[SESSION_COOKIE]
            ? next(forbidden('CSRF token missing. Please refresh and try again.'))
            : next();
    }
    if (!cookieToken)
        return next(forbidden('CSRF cookie missing. Please refresh and try again.'));
    if (!headerToken)
        return next(forbidden('CSRF token header missing.'));
    if (cookieToken !== headerToken)
        return next(forbidden('CSRF token mismatch.'));
    next();
}
const LOGIN_TOKEN_MINUTES = 15;
export async function issueLoginToken(email) {
    const token = newToken();
    await prisma.verificationToken.deleteMany({ where: { identifier: email } });
    await prisma.verificationToken.create({
        data: {
            identifier: email,
            token: digest(token),
            expires: new Date(Date.now() + LOGIN_TOKEN_MINUTES * 60_000)
        }
    });
    return token;
}
export async function consumeLoginToken(email, token) {
    const row = await prisma.verificationToken.findUnique({ where: { token: digest(token) } });
    if (!row || row.identifier !== email)
        return false;
    await prisma.verificationToken.delete({ where: { token: row.token } });
    return row.expires >= new Date();
}
/**
 * Promotes the env-configured owner account on sign-in so the operator always
 * has a way in, even on a freshly restored database.
 */
export async function ensureAdminAccount(email, password) {
    if (!env.adminEmail || !env.adminPassword)
        return null;
    if (email !== env.adminEmail || password !== env.adminPassword)
        return null;
    const passwordHash = await hashPassword(password);
    return prisma.user.upsert({
        where: { email },
        update: { role: 'ADMIN', passwordHash, name: 'VFX Cook Admin' },
        create: { email, role: 'ADMIN', passwordHash, name: 'VFX Cook Admin' }
    });
}
//# sourceMappingURL=auth.js.map