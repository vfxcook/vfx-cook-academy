import { useState, type FormEvent } from 'react';
import { Link, redirect, useLoaderData, useSearchParams, type LoaderFunctionArgs } from 'react-router';
import CinemaScene from '../components/CinemaScene';
import GoogleSignIn from '../components/GoogleSignIn';
import { Field, Notice } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { resolveGoogleClientId } from '../lib/googleIdentity';
import type { SessionState } from '../lib/types';

const SIGNED_OUT: SessionState = {
  user: null,
  access: null,
  providers: { google: true, googleClientId: null, email: false }
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

  const [mode, setMode] = useState<'password' | 'link'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(params.get('error') ?? '');
  const [linkSent, setLinkSent] = useState(false);

  // A full navigation re-runs every loader against the new session.
  const go = (landing: string) => window.location.assign(next ?? landing);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      if (mode === 'link') {
        await api.auth.requestLoginLink(email);
        setLinkSent(true);
      } else {
        const result = await api.auth.signIn({ email, password });
        go(result.redirectTo);
      }
    } catch (thrown) {
      setError(errorMessage(thrown, 'Could not sign you in.'));
    } finally {
      setBusy(false);
    }
  };

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

      {linkSent ? (
        <Notice tone="ok">
          If an account uses <strong>{email}</strong>, a sign-in link is on its way. It expires in 15
          minutes.
        </Notice>
      ) : null}

      {error ? <Notice tone="error">{error}</Notice> : null}

      {providers.google ? (
        <>
          <GoogleSignIn
            clientId={resolveGoogleClientId(providers.googleClientId)}
            mode="signin"
            autoPrompt
            onSignedIn={result => go(result.redirectTo)}
            onError={setError}
          />
          <div className="ac-row" style={{ gap: 12 }}>
            <span style={{ flex: 1, height: 1, background: 'var(--ac-border)' }} />
            <span className="ac-eyebrow">or with email</span>
            <span style={{ flex: 1, height: 1, background: 'var(--ac-border)' }} />
          </div>
        </>
      ) : null}

      <form className="ac-stack" onSubmit={submit}>
        <Field label="Email" htmlFor="email">
          <input
            id="email"
            className="ac-input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </Field>

        {mode === 'password' ? (
          <Field label="Password" htmlFor="password">
            <input
              id="password"
              className="ac-input"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="••••••••"
            />
          </Field>
        ) : null}

        <button type="submit" className="ac-btn ac-btn--ghost ac-btn--lg ac-btn--block" disabled={busy}>
          {busy ? 'Checking…' : mode === 'link' ? 'Email me a sign-in link' : 'Sign in'}
        </button>
      </form>

      <div className="ac-between">
        {providers.email ? (
          <button
            type="button"
            className="ac-btn ac-btn--quiet ac-btn--sm"
            onClick={() => {
              setMode(current => (current === 'password' ? 'link' : 'password'));
              setError('');
              setLinkSent(false);
            }}
          >
            {mode === 'password' ? 'Use an email link instead' : 'Use a password instead'}
          </button>
        ) : (
          <span />
        )}
        <Link className="ac-btn ac-btn--quiet ac-btn--sm" to={next ? `/sign-up?next=${encodeURIComponent(next)}` : '/sign-up'}>
          Create account
        </Link>
      </div>
    </CinemaScene>
  );
}
