import { useState } from 'react';
import { Link, redirect, useLoaderData, useSearchParams, type LoaderFunctionArgs } from 'react-router';
import CinemaScene from '../components/CinemaScene';
import GoogleSignIn from '../components/GoogleSignIn';
import { Notice } from '../components/ui';
import { api } from '../lib/api';
import { resolveGoogleClientId } from '../lib/googleIdentity';
import type { SessionState } from '../lib/types';

const SIGNED_OUT: SessionState = {
  user: null,
  access: null,
  providers: { google: true, googleClientId: null }
};

/** Only same-origin paths survive, so ?next= can never bounce someone off-site. */
export function safeNext(value: string | null, fallback = '/dashboard') {
  if (!value) return fallback;
  return value.startsWith('/') && !value.startsWith('//') ? value : fallback;
}

/** An explicit ?next= wins; otherwise the server's landing decides (classroom or dashboard). */
export function explicitNext(params: URLSearchParams) {
  const next = params.get('next');
  return next ? safeNext(next) : null;
}

/** Shared by the auth scenes, which sit outside the root layout and its session loader. */
export async function authSceneLoader({ request }: LoaderFunctionArgs): Promise<SessionState | Response> {
  try {
    const session = await api.auth.session();
    if (session.user) {
      return redirect(explicitNext(new URL(request.url).searchParams) ?? session.access?.landing ?? '/dashboard');
    }
    return session;
  } catch {
    return SIGNED_OUT;
  }
}

export const signInLoader = authSceneLoader;

export default function SignIn() {
  const [params] = useSearchParams();
  const { providers } = useLoaderData() as SessionState;
  const next = explicitNext(params);
  const [error, setError] = useState(params.get('error') ?? '');

  // A full navigation re-runs every loader against the new session.
  const go = (landing: string) => window.location.assign(next ?? landing);

  return (
    <CinemaScene
      eyebrow="Welcome back"
      headline={['Pick up', 'where the', 'reel stopped.']}
      lede="One BrahmAstra account across the Studio and the Academy. Your lessons, doubts and progress are exactly where you left them."
    >
      <div>
        <p className="ac-eyebrow">Sign in</p>
        <h2 className="ac-title" style={{ marginTop: 6 }}>
          Back to the floor
        </h2>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}

      {providers.google ? (
        <GoogleSignIn
          clientId={resolveGoogleClientId(providers.googleClientId)}
          mode="signin"
          autoPrompt
          onSignedIn={result => go(result.redirectTo)}
          onError={setError}
        />
      ) : (
        <Notice tone="error">
          Google sign-in is not configured on this server, so there is no way in right now.
        </Notice>
      )}

      <p className="ac-hint" style={{ textAlign: 'center' }}>
        Your Google account is the account — nothing to remember, nothing to reset. First time here?{' '}
        <Link to={next ? `/sign-up?next=${encodeURIComponent(next)}` : '/sign-up'}>Join the batch</Link>.
      </p>
    </CinemaScene>
  );
}
