import { Link, Outlet, useNavigation, useRouteLoaderData } from 'react-router';
import GoogleOneTap from '../components/GoogleOneTap';
import Header from '../components/Header';
import { api } from '../lib/api';
import { brand } from '../lib/content';
import { resolveGoogleClientId } from '../lib/googleIdentity';
import type { SessionState } from '../lib/types';

export async function rootLoader(): Promise<SessionState> {
  try {
    return await api.auth.session();
  } catch {
    // A cold or unreachable API should still render the marketing surface.
    return { user: null, access: null, providers: { google: false, googleClientId: null, email: false } };
  }
}

/** Reads the session the root loader already fetched, from anywhere in the tree. */
export function useSession(): SessionState {
  return (
    (useRouteLoaderData('root') as SessionState | undefined) ?? {
      user: null,
      access: null,
      providers: { google: false, googleClientId: null, email: false }
    }
  );
}

export default function RootLayout() {
  const session = useSession();
  const navigation = useNavigation();

  return (
    <div className="app ac-theme ac-floor">
      {navigation.state !== 'idle' ? <div className="route-busy" aria-hidden="true" /> : null}

      <Header user={session.user} />
      {!session.user && session.providers.google ? (
        <GoogleOneTap clientId={resolveGoogleClientId(session.providers.googleClientId)} />
      ) : null}

      <main className="app-main">
        <Outlet />
      </main>

      <footer className="ftr">
        <div className="ftr-inner">
          <span>
            © {new Date().getFullYear()} BrahmAstra Studio · {brand.module} — {brand.tagline}
          </span>
          <nav className="ftr-links" aria-label="Footer">
            <Link to="/courses">Courses</Link>
            <Link to="/gift/redeem">Redeem a gift</Link>
            <a href={brand.parentUrl} target="_blank" rel="noreferrer noopener">
              {brand.parent}
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
