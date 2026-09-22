import { env } from './env.js';
import type { GoogleIdentity } from './google.js';

/*
 * Mirrors a Google identity this server has already verified into the shared BrahmAstra
 * Supabase project: an Auth user (so `profiles.id` keeps its foreign key to auth.users)
 * and the profile row. Same contract as BrahmAstra Studio's sync, so a person has one
 * Supabase identity across every brahmastra.studio product. Needs the service-role key,
 * which never leaves the server.
 */

export type SupabaseSyncResult =
  | { ok: true; supabaseUserId: string; createdAuthUser: boolean; tier: 'academy' | 'shared' | 'minimal' }
  | { ok: false; skipped?: string; error?: string };

const TIMEOUT_MS = 6000;

type Fetch = typeof fetch;

const headers = (key: string) => ({
  'Content-Type': 'application/json',
  apikey: key,
  Authorization: `Bearer ${key}`
});

const readError = async (response: Response) =>
  `${response.status} ${(await response.text().catch(() => '')).slice(0, 300)}`;

async function findAuthUserId(url: string, key: string, email: string, fetchImpl: Fetch) {
  const profile = await fetchImpl(
    `${url}/rest/v1/profiles?select=id&email=eq.${encodeURIComponent(email)}&limit=1`,
    { headers: headers(key), signal: AbortSignal.timeout(TIMEOUT_MS) }
  );
  if (profile.ok) {
    const rows = (await profile.json()) as Array<{ id?: string }>;
    if (rows[0]?.id) return rows[0].id;
  }

  for (let page = 1; page <= 20; page += 1) {
    const response = await fetchImpl(`${url}/auth/v1/admin/users?page=${page}&per_page=1000`, {
      headers: headers(key),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (!response.ok) throw new Error(`Supabase user lookup failed: ${await readError(response)}`);
    const body = (await response.json()) as { users?: Array<{ id: string; email?: string }> } | Array<{ id: string; email?: string }>;
    const users = Array.isArray(body) ? body : body.users ?? [];
    const match = users.find(user => (user.email ?? '').toLowerCase() === email);
    if (match) return match.id;
    if (users.length < 1000) break;
  }
  return null;
}

async function ensureAuthUser(url: string, key: string, identity: GoogleIdentity, fetchImpl: Fetch) {
  const metadata = {
    full_name: identity.name,
    name: identity.name,
    avatar_url: identity.picture,
    picture: identity.picture,
    provider_id: identity.sub,
    email_verified: true
  };

  const created = await fetchImpl(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: headers(key),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      email: identity.email,
      email_confirm: true,
      user_metadata: metadata,
      app_metadata: { provider: 'google', providers: ['google'] }
    })
  });
  if (created.ok) return { id: ((await created.json()) as { id: string }).id, created: true };

  // 400/409/422 mean "already registered" — fall through to find and refresh that user.
  const detail = await readError(created);
  if (![400, 409, 422].includes(created.status)) throw new Error(`Supabase user create failed: ${detail}`);

  const existingId = await findAuthUserId(url, key, identity.email, fetchImpl);
  if (!existingId) throw new Error(`Supabase user create failed: ${detail}`);

  const updated = await fetchImpl(`${url}/auth/v1/admin/users/${existingId}`, {
    method: 'PUT',
    headers: headers(key),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({ user_metadata: metadata })
  });
  if (!updated.ok) console.warn(`[academy] Supabase user metadata update failed: ${await readError(updated)}`);
  return { id: existingId, created: false };
}

function upsertProfile(url: string, key: string, row: Record<string, unknown>, fetchImpl: Fetch) {
  return fetchImpl(`${url}/rest/v1/profiles?on_conflict=id`, {
    method: 'POST',
    headers: { ...headers(key), Prefer: 'resolution=merge-duplicates,return=minimal' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify([row])
  });
}

export async function syncGoogleIdentityToSupabase(params: {
  identity: GoogleIdentity;
  academy: { userId: string; member: boolean };
  at?: string;
  fetchImpl?: Fetch;
}): Promise<SupabaseSyncResult> {
  const { url, serviceRoleKey } = env.supabase;
  if (!url || !serviceRoleKey) return { ok: false, skipped: 'SUPABASE_SERVICE_ROLE_KEY is not set' };

  const fetchImpl = params.fetchImpl ?? fetch;
  const at = params.at ?? new Date().toISOString();

  try {
    const authUser = await ensureAuthUser(url, serviceRoleKey, params.identity, fetchImpl);
    const base = {
      id: authUser.id,
      email: params.identity.email,
      full_name: params.identity.name,
      avatar_url: params.identity.picture
    };
    const shared = { ...base, provider: 'google', last_sign_in_at: at, updated_at: at };

    // Only columns named here are written, so Studio-owned fields (studio_*, onboarding)
    // on the same row are never touched. The live table has drifted from its migrations,
    // so each tier drops the columns that might be missing, down to the ones that exist.
    const tiers = [
      {
        tier: 'academy' as const,
        row: {
          ...shared,
          academy_user_id: params.academy.userId,
          academy_access: params.academy.member,
          academy_last_sign_in_at: at
        }
      },
      { tier: 'shared' as const, row: shared },
      { tier: 'minimal' as const, row: base }
    ];

    const failures: string[] = [];
    for (const { tier, row } of tiers) {
      const response = await upsertProfile(url, serviceRoleKey, row, fetchImpl);
      if (response.ok) {
        return { ok: true, supabaseUserId: authUser.id, createdAuthUser: authUser.created, tier };
      }
      failures.push(`${tier}: ${await readError(response)}`);
    }
    return { ok: false, error: failures.join('; ') };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
