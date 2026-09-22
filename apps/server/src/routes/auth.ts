import { Router } from 'express';
import { z } from 'zod';
import { createSession, destroySession, requireUser } from '../lib/auth.js';
import { academyAccess } from '../lib/access.js';
import { env } from '../lib/env.js';
import { verifyGoogleCredential } from '../lib/google.js';
import { parse, route } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { rateLimit } from '../lib/rateLimit.js';
import { syncGoogleIdentityToSupabase } from '../lib/supabaseSync.js';

export const authRouter = Router();

authRouter.get(
  '/session',
  route(async (req, res) => {
    res.json({
      user: req.user ?? null,
      // Other brahmastra.studio frontends read this to know who is an Academy member.
      access: req.user ? await academyAccess(req.user) : null,
      // Google is the only way in. The client reads this to render the button.
      providers: {
        google: env.google.enabled,
        googleClientId: env.google.clientIds[0] ?? null
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
  '/sign-out',
  route(async (req, res) => {
    await destroySession(req, res);
    res.json({ ok: true });
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
