import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../src/app.js';
import { databaseFailureCode } from '../src/lib/prisma.js';

// These requests never reach the database: no session cookie means no session lookup,
// and every body here fails validation before a query runs.
let base = '';
let close = () => {};

before(async () => {
  const server = createApp().listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
});
after(() => close());

describe('api surface', () => {
  it('answers the health check', async () => {
    const response = await fetch(`${base}/healthz`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  });

  it('reports a signed-out session', async () => {
    const body = await (await fetch(`${base}/api/auth/session`)).json();
    assert.equal(body.user, null);
  });

  it('returns JSON 404s for unknown endpoints', async () => {
    const response = await fetch(`${base}/api/nope`);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).code, 'NOT_FOUND');
  });

  it('rejects a malformed Google credential before touching the database', async () => {
    const response = await fetch(`${base}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: 'too-short', nonce: 'also-too-short' })
    });
    assert.equal(response.status, 400);
  });

  // Google is the only way in. These four used to exist and must stay gone: a password
  // route quietly coming back would be a second, weaker door into the same accounts.
  for (const path of ['/api/auth/sign-in', '/api/auth/register', '/api/auth/login-link', '/api/auth/password']) {
    it(`no longer serves ${path}`, async () => {
      const response = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      assert.equal(response.status, 404);
    });
  }

  it('advertises Google as the only provider', async () => {
    const body = await (await fetch(`${base}/api/auth/session`)).json();
    assert.deepEqual(Object.keys(body.providers).sort(), ['google', 'googleClientId']);
  });

  it('refuses a write that carries a session but no CSRF token', async () => {
    const response = await fetch(`${base}/api/auth/sign-out`, {
      method: 'POST',
      headers: { Cookie: 'academy_session=forged' }
    });
    assert.equal(response.status, 403);
  });

  it('refuses a write whose CSRF header does not match the cookie', async () => {
    const response = await fetch(`${base}/api/auth/sign-out`, {
      method: 'POST',
      headers: { Cookie: 'academy_session=x; academy_csrf=one', 'X-CSRF-Token': 'two' }
    });
    assert.equal(response.status, 403);
  });

  it('keeps protected routes behind sign-in', async () => {
    for (const path of ['/api/courses/me/dashboard', '/api/studio/overview', '/api/notifications']) {
      assert.equal((await fetch(`${base}${path}`)).status, 401, path);
    }
  });

  it('rejects an unsigned Razorpay webhook', async () => {
    const response = await fetch(`${base}/api/payments/razorpay-webhook`, { method: 'POST', body: '{}' });
    assert.equal(response.status, 400);
  });
});

// The readiness check reports why the database is unreachable, using the wording Prisma 6
// puts in the message — it raises these without a code of its own. If a Prisma upgrade
// rewords them, these fail here rather than silently answering UNKNOWN in production.
describe('database failure codes', () => {
  const cases: Array<[string, string, string]> = [
    ['wrong credentials', 'Authentication failed against database server, the provided database credentials for `postgres` are not valid.', 'P1000'],
    ['unreachable host', "Can't reach database server at `db.example.supabase.co:5432`", 'P1001'],
    ['no such database', 'Database `academy` does not exist on the database server', 'P1003'],
    ['unset variable', 'error: Environment variable not found: DATABASE_URL.', 'ENV_MISSING'],
    ['quoted value', 'the URL must start with the protocol `postgresql://` or `postgres://`', 'URL_MALFORMED']
  ];

  for (const [label, message, expected] of cases) {
    it(`reads ${label} as ${expected}`, () => {
      assert.equal(databaseFailureCode(new Error(message)), expected);
    });
  }

  it('keeps a Prisma error code when there is one', () => {
    assert.equal(databaseFailureCode(Object.assign(new Error('nope'), { code: 'P2021' })), 'P2021');
  });

  it('never invents a code for something it does not recognise', () => {
    assert.equal(databaseFailureCode(new Error('the socket hung up')), 'UNKNOWN');
  });
});
