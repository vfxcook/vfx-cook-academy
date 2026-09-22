import { Router } from 'express';
import { z } from 'zod';
import {
  consumeLoginToken,
  createSession,
  destroySession,
  ensureAdminAccount,
  hashPassword,
  issueLoginToken,
  requireUser,
  verifyPassword
} from '../lib/auth.js';
import { academyAccess } from '../lib/access.js';
import { env } from '../lib/env.js';
import { verifyGoogleCredential } from '../lib/google.js';
import { badRequest, conflict, parse, route, unauthorized } from '../lib/http.js';
import { sendLoginLinkEmail } from '../lib/mailer.js';
import { prisma } from '../lib/prisma.js';
import { rateLimit } from '../lib/rateLimit.js';
import { syncGoogleIdentityToSupabase } from '../lib/supabaseSync.js';

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

authRouter.get(
  '/session',
  route(async (req, res) => {
    res.json({
      user: req.user ?? null,
      // Other brahmastra.studio frontends read this to know who is an Academy member.
      access: req.user ? await academyAccess(req.user) : null,
      providers: {
        google: env.google.enabled,
        googleClientId: env.google.clientIds[0] ?? null,
        email: env.smtp.enabled
      }
    });
  })
);

/** Every sign-in answers with who you are, whether you're a member and where to go. */
async function signedIn(user: Parameters<typeof publicUser>[0]) {
  const access = await academyAccess(user);
  return { user: publicUser(user), access, redirectTo: access.landing };
}

const perMinute = (name: string, max: number) => rateLimit({ name, windowMs: 60_000, max });

authRouter.post(
  '/register',
  perMinute('register', 5),
  route(async (req, res) => {
    const data = parse(registerSchema, req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw conflict('An account already exists with this email.');

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
    res.status(201).json(await signedIn(user));
  })
);

authRouter.post(
  '/sign-in',
  perMinute('sign-in', 10),
  route(async (req, res) => {
    const data = parse(signInSchema, req.body);

    const owner = await ensureAdminAccount(data.email, data.password);
    if (owner) {
      await createSession(req, res, owner.id);
      return res.json(await signedIn(owner));
    }

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user?.passwordHash || !(await verifyPassword(data.password, user.passwordHash))) {
      throw unauthorized('That email and password do not match.');
    }

    await createSession(req, res, user.id);
    return res.json(await signedIn(user));
  })
);

authRouter.post(
  '/sign-out',
  route(async (req, res) => {
    await destroySession(req, res);
    res.json({ ok: true });
  })
);

authRouter.post(
  '/login-link',
  perMinute('login-link', 5),
  route(async (req, res) => {
    const { email } = parse(z.object({ email: emailField }), req.body);
    if (!env.smtp.enabled) throw badRequest('Email sign-in is not available right now.');

    const user = await prisma.user.findUnique({ where: { email } });
    // Always answer the same way so this cannot be used to enumerate accounts.
    if (user) {
      const token = await issueLoginToken(email);
      const url = `${env.appUrl}/sign-in/link?email=${encodeURIComponent(email)}&token=${token}`;
      await sendLoginLinkEmail({ to: email, url });
    }
    res.json({ ok: true });
  })
);

authRouter.post(
  '/login-link/consume',
  perMinute('login-link-consume', 10),
  route(async (req, res) => {
    const { email, token } = parse(
      z.object({ email: emailField, token: z.string().min(10) }),
      req.body
    );

    if (!(await consumeLoginToken(email, token))) {
      throw unauthorized('That sign-in link is no longer valid. Request a new one.');
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw unauthorized('That account no longer exists.');

    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
    await createSession(req, res, user.id);
    res.json(await signedIn(user));
  })
);

/**
 * Google Identity Services sign-in. The browser hands over the ID token Google issued for
 * the BrahmAstra client; we verify it, find or create the Academy account, open a session,
 * then mirror the person into the shared Supabase project.
 *
 * Accounts are matched on Google's stable subject id first and email second, so someone
 * whose Google address changed still lands on the account that holds their purchases.
 */
authRouter.post(
  '/google',
  perMinute('google', 20),
  route(async (req, res) => {
    const { credential, nonce } = parse(
      z.object({ credential: z.string().min(20), nonce: z.string().min(16).max(256) }),
      req.body
    );
    const google = await verifyGoogleCredential(credential, nonce);
    const isOwner = Boolean(env.adminEmail) && google.email === env.adminEmail;

    const linked = await prisma.account.findUnique({
      where: { provider_providerAccountId: { provider: 'google', providerAccountId: google.sub } },
      select: { userId: true }
    });
    const existing = linked
      ? await prisma.user.findUnique({ where: { id: linked.userId } })
      : await prisma.user.findUnique({ where: { email: google.email } });

    // A name or avatar someone set themselves is kept; Google only fills the gaps.
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            name: existing.name || google.name,
            image: existing.image || google.picture,
            emailVerified: existing.emailVerified ?? new Date(),
            ...(isOwner ? { role: 'ADMIN' as const } : {})
          }
        })
      : await prisma.user.create({
          data: {
            email: google.email,
            name: google.name,
            image: google.picture,
            emailVerified: new Date(),
            role: isOwner ? 'ADMIN' : 'STUDENT'
          }
        });

    if (!linked) {
      await prisma.account.create({
        data: {
          userId: user.id,
          type: 'oidc',
          provider: 'google',
          providerAccountId: google.sub
        }
      });
    }

    await createSession(req, res, user.id);
    const body = await signedIn(user);

    const supabase = await syncGoogleIdentityToSupabase({
      identity: google,
      academy: { userId: user.id, member: body.access.member }
    });
    if (!supabase.ok) {
      console.warn(`[academy] Supabase sync for ${google.email} did not complete: ${supabase.skipped ?? supabase.error}`);
    }

    res.status(existing ? 200 : 201).json({
      ...body,
      created: !existing,
      supabase: supabase.ok
        ? { synced: true, userId: supabase.supabaseUserId }
        : { synced: false, reason: supabase.skipped ? 'not-configured' : 'sync-failed' }
    });
  })
);

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  image: z.string().trim().url().max(500).optional().or(z.literal(''))
});

authRouter.patch(
  '/profile',
  requireUser,
  route(async (req, res) => {
    const data = parse(profileSchema, req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      // An empty avatar field clears it, falling back to initials.
      data: { name: data.name, phone: data.phone || null, image: data.image || null }
    });
    res.json({ user: publicUser(user) });
  })
);

const passwordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, 'Use at least 8 characters.').max(128)
});

authRouter.post(
  '/password',
  requireUser,
  route(async (req, res) => {
    const data = parse(passwordSchema, req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw unauthorized();

    // Accounts created through Google have no password yet, so the current one is only
    // demanded when there is something to compare against.
    if (user.passwordHash) {
      if (!data.currentPassword) throw badRequest('Enter your current password.');
      if (!(await verifyPassword(data.currentPassword, user.passwordHash))) {
        throw badRequest('That current password is not right.');
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(data.newPassword) }
    });
    res.json({ ok: true });
  })
);

function publicUser(user: {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  phone: string | null;
  role: string;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    phone: user.phone,
    role: user.role as 'STUDENT' | 'ADMIN'
  };
}
