import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { env } from './env.js';
import { ApiError } from './http.js';

export type GoogleIdentity = {
  sub: string;
  email: string;
  name: string;
  picture: string | null;
};

/** Checks signature, issuer, audience and expiry; returns the token's claims. */
export type IdTokenVerifier = (idToken: string, audience: string[]) => Promise<TokenPayload | undefined>;

const client = new OAuth2Client();

/** Google's own library fetches and caches the signing certificates. */
const verifyWithGoogle: IdTokenVerifier = async (idToken, audience) =>
  (await client.verifyIdToken({ idToken, audience })).getPayload();

const unverified = (message: string) => new ApiError(401, message, 'GOOGLE_UNVERIFIED');

/**
 * Verifies a Google Identity Services credential. The library covers the cryptography;
 * the nonce and the verified-email check are ours — the nonce ties the token to the
 * sign-in this browser started, so a token lifted from elsewhere cannot be replayed here.
 */
export async function verifyGoogleCredential(
  credential: string,
  nonce: string,
  verify: IdTokenVerifier = verifyWithGoogle
): Promise<GoogleIdentity> {
  let payload: TokenPayload | undefined;
  try {
    payload = await verify(credential, env.google.clientIds);
  } catch {
    throw unverified('Google sign-in could not be verified. Try again.');
  }

  if (!payload?.sub) throw unverified('Google did not identify the account.');
  if (!payload.email) throw unverified('Your Google account has no email address attached.');

  const emailVerified = payload.email_verified as boolean | string | undefined;
  if (emailVerified !== true && emailVerified !== 'true') {
    throw unverified('Verify the email on your Google account, then try again.');
  }
  if (!nonce || payload.nonce !== nonce) {
    throw unverified('That Google sign-in did not start here. Try again.');
  }

  const email = payload.email.toLowerCase();
  return {
    sub: payload.sub,
    email,
    name:
      payload.name?.trim() ||
      [payload.given_name, payload.family_name].filter(Boolean).join(' ').trim() ||
      email.split('@')[0],
    picture: payload.picture ?? null
  };
}
