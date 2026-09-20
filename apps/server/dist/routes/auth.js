import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { consumeLoginToken, createSession, destroySession, ensureAdminAccount, hashPassword, issueLoginToken, requireUser, verifyPassword } from '../lib/auth.js';
import { env } from '../lib/env.js';
import { badRequest, conflict, parse, route, unauthorized } from '../lib/http.js';
import { sendLoginLinkEmail } from '../lib/mailer.js';
import { prisma } from '../lib/prisma.js';
export const authRouter = Router();
const emailField = z.string().trim().toLowerCase().email('Enter a valid email address.');
const registerSchema = z.object({
    name: z.string().trim().min(2, 'Tell us your name.').max(80),
    email: emailField,
    password: z.string().min(8, 'Use at least 8 characters.').max(128),
    phone: z.string().trim().min(8).max(20).optional().or(z.literal(''))
});
const signInSchema = z.object({
    email: emailField,
    password: z.string().min(1, 'Enter your password.')
});
authRouter.get('/session', (req, res) => {
    res.json({
        user: req.user ?? null,
        providers: { google: env.google.enabled, email: env.smtp.enabled }
    });
});
authRouter.post('/register', route(async (req, res) => {
    const data = parse(registerSchema, req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing)
        throw conflict('An account already exists with this email.');
    const user = await prisma.user.create({
        data: {
            name: data.name,
            email: data.email,
            phone: data.phone || null,
            passwordHash: await hashPassword(data.password),
            role: 'STUDENT'
        }
    });
    await createSession(req, res, user.id);
    res.status(201).json({ user: publicUser(user) });
}));
authRouter.post('/sign-in', route(async (req, res) => {
    const data = parse(signInSchema, req.body);
    const owner = await ensureAdminAccount(data.email, data.password);
    if (owner) {
        await createSession(req, res, owner.id);
        return res.json({ user: publicUser(owner) });
    }
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user?.passwordHash || !(await verifyPassword(data.password, user.passwordHash))) {
        throw unauthorized('That email and password do not match.');
    }
    await createSession(req, res, user.id);
    return res.json({ user: publicUser(user) });
}));
authRouter.post('/sign-out', route(async (req, res) => {
    await destroySession(req, res);
    res.json({ ok: true });
}));
authRouter.post('/login-link', route(async (req, res) => {
    const { email } = parse(z.object({ email: emailField }), req.body);
    if (!env.smtp.enabled)
        throw badRequest('Email sign-in is not available right now.');
    const user = await prisma.user.findUnique({ where: { email } });
    // Always answer the same way so this cannot be used to enumerate accounts.
    if (user) {
        const token = await issueLoginToken(email);
        const url = `${env.appUrl}/sign-in/link?email=${encodeURIComponent(email)}&token=${token}`;
        await sendLoginLinkEmail({ to: email, url });
    }
    res.json({ ok: true });
}));
authRouter.post('/login-link/consume', route(async (req, res) => {
    const { email, token } = parse(z.object({ email: emailField, token: z.string().min(10) }), req.body);
    if (!(await consumeLoginToken(email, token))) {
        throw unauthorized('That sign-in link is no longer valid. Request a new one.');
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
        throw unauthorized('That account no longer exists.');
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
    await createSession(req, res, user.id);
    res.json({ user: publicUser(user) });
}));
const OAUTH_STATE_COOKIE = 'academy_oauth_state';
const googleRedirectUri = () => `${env.appUrl.replace(/\/$/, '')}/api/auth/google/callback`;
authRouter.get('/google', (req, res) => {
    if (!env.google.enabled)
        throw badRequest('Google sign-in is not configured.');
    const state = crypto.randomBytes(16).toString('base64url');
    res.cookie(OAUTH_STATE_COOKIE, state, {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.production,
        maxAge: 10 * 60_000,
        path: '/'
    });
    const params = new URLSearchParams({
        client_id: env.google.clientId,
        redirect_uri: googleRedirectUri(),
        response_type: 'code',
        scope: 'openid email profile',
        state,
        prompt: 'select_account'
    });
    const next = typeof req.query.next === 'string' ? req.query.next : '';
    if (next)
        params.set('state', `${state}.${Buffer.from(next).toString('base64url')}`);
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});
authRouter.get('/google/callback', route(async (req, res) => {
    const fail = (reason) => res.redirect(`/sign-in?error=${encodeURIComponent(reason)}`);
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const [stateToken, encodedNext] = state.split('.');
    res.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });
    if (!code || !stateToken || stateToken !== req.cookies?.[OAUTH_STATE_COOKIE]) {
        return fail('Google sign-in could not be verified. Please try again.');
    }
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: env.google.clientId,
            client_secret: env.google.clientSecret,
            redirect_uri: googleRedirectUri(),
            grant_type: 'authorization_code'
        })
    });
    if (!tokenResponse.ok)
        return fail('Google rejected the sign-in. Please try again.');
    const tokens = (await tokenResponse.json());
    if (!tokens.access_token)
        return fail('Google did not return an access token.');
    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    if (!profileResponse.ok)
        return fail('Could not read your Google profile.');
    const profile = (await profileResponse.json());
    if (!profile.email)
        return fail('Your Google account has no email address attached.');
    const email = profile.email.toLowerCase();
    const isOwner = Boolean(env.adminEmail) && email === env.adminEmail;
    const user = await prisma.user.upsert({
        where: { email },
        update: {
            name: profile.name ?? undefined,
            image: profile.picture ?? undefined,
            emailVerified: profile.email_verified ? new Date() : undefined,
            ...(isOwner ? { role: 'ADMIN' } : {})
        },
        create: {
            email,
            name: profile.name ?? null,
            image: profile.picture ?? null,
            emailVerified: profile.email_verified ? new Date() : null,
            role: isOwner ? 'ADMIN' : 'STUDENT'
        }
    });
    await prisma.account.upsert({
        where: { provider_providerAccountId: { provider: 'google', providerAccountId: profile.sub } },
        update: {
            access_token: tokens.access_token,
            id_token: tokens.id_token,
            refresh_token: tokens.refresh_token,
            expires_at: tokens.expires_in ? Math.floor(Date.now() / 1000) + tokens.expires_in : null,
            scope: tokens.scope,
            token_type: tokens.token_type
        },
        create: {
            userId: user.id,
            type: 'oauth',
            provider: 'google',
            providerAccountId: profile.sub,
            access_token: tokens.access_token,
            id_token: tokens.id_token,
            refresh_token: tokens.refresh_token,
            expires_at: tokens.expires_in ? Math.floor(Date.now() / 1000) + tokens.expires_in : null,
            scope: tokens.scope,
            token_type: tokens.token_type
        }
    });
    await createSession(req, res, user.id);
    let next = '/dashboard';
    if (encodedNext) {
        const decoded = Buffer.from(encodedNext, 'base64url').toString('utf8');
        // Only same-origin paths, so the OAuth round trip cannot become an open redirect.
        if (decoded.startsWith('/') && !decoded.startsWith('//'))
            next = decoded;
    }
    return res.redirect(next);
}));
const profileSchema = z.object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().max(20).optional().or(z.literal('')),
    image: z.string().trim().url().max(500).optional().or(z.literal(''))
});
authRouter.patch('/profile', requireUser, route(async (req, res) => {
    const data = parse(profileSchema, req.body);
    const user = await prisma.user.update({
        where: { id: req.user.id },
        data: { name: data.name, phone: data.phone || null, image: data.image || undefined }
    });
    res.json({ user: publicUser(user) });
}));
const passwordSchema = z.object({
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8, 'Use at least 8 characters.').max(128)
});
authRouter.post('/password', requireUser, route(async (req, res) => {
    const data = parse(passwordSchema, req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user)
        throw unauthorized();
    // Accounts created through Google have no password yet, so the current one is only
    // demanded when there is something to compare against.
    if (user.passwordHash) {
        if (!data.currentPassword)
            throw badRequest('Enter your current password.');
        if (!(await verifyPassword(data.currentPassword, user.passwordHash))) {
            throw badRequest('That current password is not right.');
        }
    }
    await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(data.newPassword) }
    });
    res.json({ ok: true });
}));
function publicUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        phone: user.phone,
        role: user.role
    };
}
//# sourceMappingURL=auth.js.map