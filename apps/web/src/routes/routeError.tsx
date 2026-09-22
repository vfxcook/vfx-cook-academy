import { Link, isRouteErrorResponse, useRouteError } from 'react-router';
import { Letterbox, SceneBackdrop, SceneHeader } from '../components/CinemaScene';
import { ApiError } from '../lib/api';

type ErrorView = {
  slate: string;
  title: string;
  body: string;
  action: { to: string; label: string };
};

const home = { to: '/', label: 'Back to the start' };

function readError(error: unknown): ErrorView {
  const status =
    error instanceof ApiError ? error.status : isRouteErrorResponse(error) ? error.status : 0;
  const message =
    error instanceof ApiError
      ? error.message
      : isRouteErrorResponse(error)
        ? error.statusText
        : error instanceof Error
          ? error.message
          : '';

  if (status === 401) {
    return {
      slate: '401',
      title: 'You need to be signed in',
      body: 'This part of the Academy is for enrolled students. Sign in and we will bring you straight back.',
      action: { to: `/sign-in?next=${encodeURIComponent(window.location.pathname)}`, label: 'Sign in' }
    };
  }
  if (status === 403) {
    return {
      slate: '403',
      title: 'Not unlocked yet',
      body: message || 'You do not have access to this yet.',
      action: { to: '/courses', label: 'Browse courses' }
    };
  }
  if (status === 404) {
    return {
      slate: '404',
      title: 'Nothing on this reel',
      body: message && message !== 'Not Found' ? message : 'The page you were after is not here.',
      action: home
    };
  }
  if (status >= 500 || status === 0) {
    return {
      slate: status ? String(status) : 'ERR',
      title: 'Something broke mid-take',
      body:
        status === 0 && !(error instanceof Error)
          ? 'An unexpected error stopped the page from loading.'
          : 'The Academy could not load this. Try again in a moment.',
      action: home
    };
  }
  return { slate: String(status), title: 'That did not go through', body: message, action: home };
}

function ErrorCopy({ view }: { view: ErrorView }) {
  return (
    <div
      style={{
        display: 'grid',
        gap: 18,
        maxWidth: 520,
        textAlign: 'center',
        justifyItems: 'center',
        margin: '0 auto'
      }}
    >
      <p className="ac-eyebrow">Scene {view.slate}</p>
      <h1 className="ac-display" style={{ fontSize: 'clamp(30px, 4.6vw, 52px)' }}>
        {view.title}
      </h1>
      <p className="ac-lede">{view.body}</p>
      <Link className="ac-btn ac-btn--primary ac-btn--lg" to={view.action.to}>
        {view.action.label}
      </Link>
    </div>
  );
}

/**
 * Route error screen. Inside the app shell it renders only the copy, since the header is
 * already on screen; at the top level it brings its own cinematic scene.
 */
export default function RouteError({ inShell = false }: { inShell?: boolean }) {
  const view = readError(useRouteError());

  if (inShell) {
    return (
      <div className="ac-shell" style={{ padding: 'clamp(56px, 10vw, 120px) 16px' }}>
        <ErrorCopy view={view} />
      </div>
    );
  }

  return (
    <div className="sc">
      <SceneBackdrop />
      <Letterbox />
      <SceneHeader />
      <main style={{ display: 'grid', placeItems: 'center', minHeight: '62dvh', padding: '40px 16px' }}>
        <ErrorCopy view={view} />
      </main>
    </div>
  );
}

/** Loader for the catch-all route, so unknown paths flow through the 404 above. */
export function notFoundLoader(): never {
  throw new Response('Not Found', { status: 404 });
}
