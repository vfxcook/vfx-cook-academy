import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { describe, it } from 'node:test';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../src/lib/env.js';
import { verifyGoogleCredential, type IdTokenVerifier } from '../src/lib/google.js';

// A real RS256 key and Google's own library doing the signature, audience and expiry
// checks — only the certificate source is swapped for this test key.
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'test-key';
const certs = { [KID]: publicKey.export({ type: 'spki', format: 'pem' }).toString() };
const client = new OAuth2Client();
const verifier: IdTokenVerifier = async (token, audience) =>
  (await client.verifySignedJwtWithCertsAsync(token, certs, audience, ['accounts.google.com', 'https://accounts.google.com'])).getPayload();

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const now = () => Math.floor(Date.now() / 1000);

function sign(claims: Record<string, unknown>, key = privateKey) {
  const head = b64({ alg: 'RS256', kid: KID, typ: 'JWT' });
  const body = b64({
    iss: 'https://accounts.google.com',
    aud: env.google.clientIds[0],
    sub: '1234567890',
    email: 'Meera@Example.com',
    email_verified: true,
    name: 'Meera Suresh',
    picture: 'https://lh3.googleusercontent.com/a/photo',
    nonce: 'nonce-from-this-browser',
    iat: now(),
    exp: now() + 3600,
    ...claims
  });
  const signature = crypto.sign('RSA-SHA256', Buffer.from(`${head}.${body}`), key).toString('base64url');
  return `${head}.${body}.${signature}`;
}

const NONCE = 'nonce-from-this-browser';

describe('Google credential verification', () => {
  it('defaults to the BrahmAstra Studio client id', () => {
    assert.equal(env.google.clientIds[0], '706720560213-1f3dmo50amk180u2a7o6qcuqh2hm435i.apps.googleusercontent.com');
  });

  it('accepts a valid token and normalises the identity', async () => {
    const identity = await verifyGoogleCredential(sign({}), NONCE, verifier);
    assert.deepEqual(identity, {
      sub: '1234567890',
      email: 'meera@example.com',
      name: 'Meera Suresh',
      picture: 'https://lh3.googleusercontent.com/a/photo'
    });
  });

  for (const [label, claims, nonce] of [
    ['a token minted for another app', { aud: 'someone-else.apps.googleusercontent.com' }, NONCE],
    ['an expired token', { iat: now() - 7200, exp: now() - 3600 }, NONCE],
    ['a token from another issuer', { iss: 'https://evil.example.com' }, NONCE],
    ['an unverified email', { email_verified: false }, NONCE],
    ['a replayed token (nonce mismatch)', {}, 'a-different-sign-in'],
    ['a token with no nonce expected', {}, '']
  ] as const) {
    it(`rejects ${label}`, async () => {
      await assert.rejects(verifyGoogleCredential(sign(claims), nonce, verifier), { status: 401 });
    });
  }

  it('rejects a token signed with someone else’s key', async () => {
    const intruder = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
    await assert.rejects(verifyGoogleCredential(sign({}, intruder), NONCE, verifier), { status: 401 });
  });
});
