import { useState, type FormEvent } from 'react';
import { redirect, useLoaderData, type LoaderFunctionArgs } from 'react-router';
import CinemaScene from '../components/CinemaScene';
import { Field, Notice } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { safeNext } from './signIn';

/** Accounts without a phone number (usually Google sign-ups) stop here once. */
export async function onboardingLoader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get('next'));

  const session = await api.auth.session().catch(() => null);
  if (!session?.user) return redirect(`/sign-in?next=${encodeURIComponent(url.pathname + url.search)}`);
  if (session.user.phone) return redirect(next);

  return { user: session.user, next };
}

export default function Onboarding() {
  const { user, next } = useLoaderData() as Exclude<Awaited<ReturnType<typeof onboardingLoader>>, Response>;

  const [name, setName] = useState(user.name ?? '');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.auth.updateProfile({ name: name.trim(), phone: phone.trim(), image: user.image ?? undefined });
      window.location.assign(next);
    } catch (thrown) {
      setError(errorMessage(thrown, 'Could not save that.'));
      setBusy(false);
    }
  };

  return (
    <CinemaScene
      eyebrow="One last take"
      headline={['Before the', 'lights go', 'down.']}
      lede="We use your phone number only for enrolment and payment support — never for marketing."
    >
      <div>
        <p className="ac-eyebrow">Complete your profile</p>
        <h2 className="ac-title" style={{ marginTop: 6 }}>
          How do we reach you?
        </h2>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <form className="ac-stack" onSubmit={submit}>
        <Field label="Your name" htmlFor="onboard-name">
          <input
            id="onboard-name"
            className="ac-input"
            autoComplete="name"
            required
            minLength={2}
            maxLength={80}
            value={name}
            onChange={event => setName(event.target.value)}
          />
        </Field>

        <Field label="Email" htmlFor="onboard-email">
          <input id="onboard-email" className="ac-input" value={user.email ?? ''} readOnly />
        </Field>

        <Field label="Phone" htmlFor="onboard-phone">
          <input
            id="onboard-phone"
            className="ac-input"
            type="tel"
            autoComplete="tel"
            required
            minLength={8}
            maxLength={20}
            value={phone}
            onChange={event => setPhone(event.target.value)}
            placeholder="+91 98470 00000"
          />
        </Field>

        <button type="submit" className="ac-btn ac-btn--primary ac-btn--lg ac-btn--block" disabled={busy}>
          {busy ? 'Saving…' : 'Save and continue'}
        </button>
      </form>
    </CinemaScene>
  );
}
