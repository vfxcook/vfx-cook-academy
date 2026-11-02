import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';

// Configure before the env module loads, the way Render would.
process.env.ALLOWED_ORIGINS = 'https://frameon.si, https://*.frameon.si';
process.env.PROXY_SHARED_SECRET = 'worker-proof';
process.env.COOKIE_DOMAIN = '.frameon.si';

const { originAllowed, clientIp } = await import('../src/lib/crossOrigin.js');
const { createApp } = await import('../src/app.js');

let base = '';
let close = () => {};
before(async () => {
  const server = createApp().listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
});
after(() => close());

describe('allowed origins', () => {
  it('accepts the Studio, any Academy subdomain depth and local dev', () => {
    for (const origin of [
      'https://frameon.si',
      'https://academy.frameon.si',
      'https://app.frameon.si',
      'https://preview.academy.frameon.si',
      'http://localhost:5173'
    ]) {
      assert.equal(originAllowed(origin), true, origin);
    }
  });

  it('refuses look-alikes and plain http', () => {
    for (const origin of [
      'https://evilframeon.si',
      'https://frameon.si.evil.com',
      'http://academy.frameon.si',
      'https://frameon.sis'
    ]) {
      assert.equal(originAllowed(origin), false, origin);
    }
  });
});

describe('credentialed CORS', () => {
  it('lets a frameon.si frontend read the session', async () => {
    const response = await fetch(`${base}/api/auth/session`, { headers: { Origin: 'https://app.frameon.si' } });
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://app.frameon.si');
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
    const body = await response.json();
    assert.equal(body.user, null);
    assert.equal(body.providers.googleClientId, '706720560213-1f3dmo50amk180u2a7o6qcuqh2hm435i.apps.googleusercontent.com');
  });

  it('answers preflights for writes with the CSRF header allowed', async () => {
    const response = await fetch(`${base}/api/auth/google`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://academy.frameon.si',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-csrf-token'
      }
    });
    assert.equal(response.status, 204);
    assert.match(response.headers.get('access-control-allow-headers') ?? '', /X-CSRF-Token/);
  });

  it('gives other sites nothing to read', async () => {
    const response = await fetch(`${base}/api/auth/session`, { headers: { Origin: 'https://evil.example.com' } });
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  });

  it('turns away a forged Google credential', async () => {
    const response = await fetch(`${base}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: 'x'.repeat(40), nonce: 'n'.repeat(24) })
    });
    assert.equal(response.status, 401);
  });
});

describe('client IP through the Cloudflare Worker', () => {
  const run = (headers: Record<string, string>) => {
    const req = { ip: '172.70.1.1', get: (name: string) => headers[name] } as never;
    let seen: string | undefined;
    clientIp(req, {} as never, () => {
      seen = (req as { clientIp?: string }).clientIp;
    });
    return seen;
  };

  it('trusts the forwarded address only with the Worker’s proof', () => {
    assert.equal(run({ 'X-Academy-Proxy': 'worker-proof', 'X-Forwarded-For': '49.37.1.2, 172.70.1.1' }), '49.37.1.2');
  });

  it('ignores a spoofed forwarded address', () => {
    assert.equal(run({ 'X-Academy-Proxy': 'guess', 'X-Forwarded-For': '1.2.3.4' }), '172.70.1.1');
    assert.equal(run({ 'X-Forwarded-For': '1.2.3.4' }), '172.70.1.1');
  });
});

// A cookie carrying a Domain the page does not sit under is discarded by the browser, and
// the person is left looking signed out with a perfectly good session row in the database.
describe('session cookie scope', () => {
  const cookiesFor = async (host: string) => {
    const response = await fetch(`${base}/api/auth/sign-out`, {
      method: 'POST',
      headers: { 'X-Forwarded-Host': host }
    });
    return response.headers.getSetCookie().join(' | ');
  };

  it('shares the session across frameon.si subdomains', async () => {
    const cookies = await cookiesFor('academy.frameon.si');
    assert.match(cookies, /Domain=\.frameon\.si/);
  });

  it('keeps it host-only on the apex itself', async () => {
    const cookies = await cookiesFor('frameon.si');
    assert.match(cookies, /Domain=\.frameon\.si/);
  });

  it('drops the domain on a host outside it, so preview URLs can sign in', async () => {
    for (const host of ['academy.frameon.workers.dev', 'localhost:5173', 'frameon.si.evil.example']) {
      const cookies = await cookiesFor(host);
      assert.doesNotMatch(cookies, /Domain=/, `${host} should get a host-only cookie`);
    }
  });
});
