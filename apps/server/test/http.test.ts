import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../src/app.js';

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

  it('rejects malformed sign-ins before touching the database', async () => {
    const response = await fetch(`${base}/api/auth/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: '' })
    });
    assert.equal(response.status, 400);
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
