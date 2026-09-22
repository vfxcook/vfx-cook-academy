import { useState, type FormEvent } from 'react';
import { Link, redirect, useLoaderData, useSearchParams } from 'react-router';
import CinemaScene from '../components/CinemaScene';
import GoogleButton from '../components/GoogleButton';
import { Field, Notice } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import type { SessionState } from '../lib/types';

/** Shared by the auth scenes, which sit outside the root layout and its session loader. */
export async function authSceneLoader(): Promise<SessionState | Response> {
  try {
    const session = await api.auth.session();
    if (session.user) return redirect('/dashboard');
    return session;
  } catch {
    return { user: null, providers: { google: false, email: false } };
  }
}

export const signInLoader = authSceneLoader;

/** Only same-origin paths survive, so ?next= can never bounce someone off-site. */
export function safeNext(value: string | null, fallback = '/dashboard') {
  if (!value) return fallback;
  return value.startsWith('/') && !value.startsWith('//') ? value : fallback;
}

export default function SignIn() {
  const [params] = useSearchParams();
  const { providers } = useLoaderData() as SessionState;
  const next = safeNext(params.get('next'));

  const [mode, setMode] = useState<'password' | 'link'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(params.get('error') ?? '');
  const [linkSent, setLinkSent] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      if (mode === 'link') {
        await api.auth.requestLoginLink(email);
        setLinkSent(true);
      } else {
        await api.auth.signIn({ email, password });
        // A full navigation re-runs every loader against the new session.
        window.location.assign(next);
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
      lede="Your lessons, your doubts and your progress are exactly where you left them."
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
          <GoogleButton enabled next={next} label="Continue with Google" />
          <div className="ac-row" style={{ gap: 12 }}>
            <span style={{ flex: 1, height: 1, background: 'var(--ac-border)' }} />
            <span className="ac-eyebrow">or</span>
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

        <button type="submit" className="ac-btn ac-btn--primary ac-btn--lg ac-btn--block" disabled={busy}>
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
        <Link className="ac-btn ac-btn--quiet ac-btn--sm" to="/sign-up">
          Create account
        </Link>
      </div>
    </CinemaScene>
  );
}
