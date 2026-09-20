import { useState, type FormEvent } from 'react';
import { Link, redirect, useSearchParams } from 'react-router';
import CinemaScene from '../components/CinemaScene';
import GoogleButton from '../components/GoogleButton';
import { Field, Notice } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { safeNext } from './signIn';

export async function signUpLoader() {
  const session = await api.auth.session();
  if (session.user) return redirect('/dashboard');
  return session;
}

export default function SignUp() {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));

  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm(current => ({ ...current, [key]: event.target.value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await api.auth.register({
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined
      });
      window.location.assign(next);
    } catch (thrown) {
      setError(errorMessage(thrown, 'Could not create that account.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <CinemaScene
      eyebrow="Join the batch"
      headline={['Learn the craft', 'behind the', 'generation.']}
      ghost="Not the button."
      lede="One account gets you the courses, the community wall and the AI Studio credits — and it carries into brahmastra.studio."
    >
      <div>
        <p className="ac-eyebrow">Create account</p>
        <h2 className="ac-title" style={{ marginTop: 6 }}>
          Take your seat
        </h2>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <GoogleButton next={next} label="Sign up with Google" />

      <div className="ac-row" style={{ gap: 12 }}>
        <span style={{ flex: 1, height: 1, background: 'var(--ac-border)' }} />
        <span className="ac-eyebrow">or</span>
        <span style={{ flex: 1, height: 1, background: 'var(--ac-border)' }} />
      </div>

      <form className="ac-stack" onSubmit={submit}>
        <Field label="Your name" htmlFor="name">
          <input
            id="name"
            className="ac-input"
            autoComplete="name"
            required
            minLength={2}
            value={form.name}
            onChange={set('name')}
            placeholder="Anish M Prasad"
          />
        </Field>

        <Field label="Email" htmlFor="email">
          <input
            id="email"
            className="ac-input"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={set('email')}
            placeholder="you@example.com"
          />
        </Field>

        <Field label="Phone" htmlFor="phone" hint="Optional — used only for payment follow-ups.">
          <input
            id="phone"
            className="ac-input"
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={set('phone')}
            placeholder="+91 98470 00000"
          />
        </Field>

        <Field label="Password" htmlFor="password" hint="At least 8 characters.">
          <input
            id="password"
            className="ac-input"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={form.password}
            onChange={set('password')}
            placeholder="••••••••"
          />
        </Field>

        <button type="submit" className="ac-btn ac-btn--primary ac-btn--lg ac-btn--block" disabled={busy}>
          {busy ? 'Creating…' : 'Create my account'}
        </button>
      </form>

      <p className="ac-hint" style={{ textAlign: 'center' }}>
        Already enrolled? <Link to="/sign-in">Sign in</Link>
      </p>
    </CinemaScene>
  );
}
