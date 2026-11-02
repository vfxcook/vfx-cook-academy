import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

process.env.SUPABASE_URL = 'https://project.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

const { syncGoogleIdentityToSupabase } = await import('../src/lib/supabaseSync.js');

const identity = { sub: '42', email: 'meera@example.com', name: 'Meera Suresh', picture: null };

/** A scripted Supabase: each call takes the next canned response and is recorded. */
function fakeSupabase(script: Array<{ status: number; body?: unknown }>) {
  const calls: Array<{ method: string; url: string; body: unknown }> = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ method: init?.method ?? 'GET', url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null });
    const next = script.shift() ?? { status: 500 };
    return new Response(next.body === undefined ? null : JSON.stringify(next.body), { status: next.status });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

describe('Supabase identity mirror', () => {
  it('creates the Auth user and writes the Academy profile', async () => {
    const { fetchImpl, calls } = fakeSupabase([{ status: 200, body: { id: 'uuid-1' } }, { status: 201 }]);
    const result = await syncGoogleIdentityToSupabase({ identity, academy: { userId: 'u1', member: true }, fetchImpl });

    assert.deepEqual(result, { ok: true, supabaseUserId: 'uuid-1', createdAuthUser: true, tier: 'academy' });
    const profile = calls[1].body as Array<Record<string, unknown>>;
    assert.equal(profile[0].academy_access, true);
    assert.equal(profile[0].academy_user_id, 'u1');
    // Studio-owned columns on the shared row are never written by the Academy.
    assert.ok(!Object.keys(profile[0]).some(key => key.startsWith('studio_')));
  });

  it('reuses an existing Auth user and steps down when Academy columns are missing', async () => {
    const { fetchImpl, calls } = fakeSupabase([
      { status: 422, body: { msg: 'already registered' } },
      { status: 200, body: [{ id: 'uuid-7' }] },
      { status: 200, body: {} },
      { status: 400, body: { code: 'PGRST204', message: "Could not find the 'academy_access' column" } },
      { status: 201 }
    ]);
    const result = await syncGoogleIdentityToSupabase({ identity, academy: { userId: 'u1', member: false }, fetchImpl });

    assert.deepEqual(result, { ok: true, supabaseUserId: 'uuid-7', createdAuthUser: false, tier: 'shared' });
    assert.equal(calls[2].method, 'PUT');
    assert.ok(!('academy_access' in (calls[4].body as Array<Record<string, unknown>>)[0]));
  });

  it('reports failure without throwing when Supabase is down', async () => {
    const { fetchImpl } = fakeSupabase([{ status: 503, body: 'unavailable' }]);
    const result = await syncGoogleIdentityToSupabase({ identity, academy: { userId: 'u1', member: false }, fetchImpl });
    assert.equal(result.ok, false);
  });
});
