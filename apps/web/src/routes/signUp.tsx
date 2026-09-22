import { useState } from 'react';
import { Link, useLoaderData, useSearchParams } from 'react-router';
import CinemaScene from '../components/CinemaScene';
import GoogleSignIn from '../components/GoogleSignIn';
import { Notice } from '../components/ui';
import { resolveGoogleClientId } from '../lib/googleIdentity';
import type { SessionState } from '../lib/types';
import { authSceneLoader, explicitNext } from './signIn';

export const signUpLoader = authSceneLoader;

export default function SignUp() {
  const [params] = useSearchParams();
  const { providers } = useLoaderData() as SessionState;
  const next = explicitNext(params);
  const [error, setError] = useState('');

  const go = (landing: string) => window.location.assign(next ?? landing);

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

      {providers.google ? (
        <GoogleSignIn
          clientId={resolveGoogleClientId(providers.googleClientId)}
          mode="signup"
          autoPrompt={false}
          onSignedIn={result => go(result.redirectTo)}
          onError={setError}
        />
      ) : (
        <Notice tone="error">
          Google sign-in is not configured on this server, so accounts cannot be created right now.
        </Notice>
      )}

      <p className="ac-hint" style={{ textAlign: 'center' }}>
        Continuing with Google creates your seat — there is no password to choose and none to lose.
        Already enrolled?{' '}
        <Link to={next ? `/sign-in?next=${encodeURIComponent(next)}` : '/sign-in'}>Sign in</Link>
      </p>
    </CinemaScene>
  );
}
