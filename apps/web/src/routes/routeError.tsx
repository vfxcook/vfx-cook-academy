import { Link, isRouteErrorResponse, useRouteError } from 'react-router';
import { Letterbox, SceneBackdrop, SceneHeader } from '../components/CinemaScene';
import { ApiError } from '../lib/api';

function readError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return {
        slate: '401',
        title: 'You need to be signed in',
        body: 'This part of the Academy is for enrolled students. Sign in and we will bring you straight back.',
        action: { to: '/sign-in', label: 'Sign in' }
      };
    }
    if (error.status === 403) {
      return {
        slate: '403',
        title: 'Not unlocked yet',
        body: error.message,
        action: { to: '/courses', label: 'Browse courses' }
      };
    }
    if (error.status === 404) {
      return {
        slate: '404',
        title: 'Nothing on this reel',
        body: error.message,
        action: { to: '/', label: 'Back to the start' }
      };
    }
    return {
      slate: String(error.status),
      title: 'That did not go through',
      body: error.message,
      action: { to: '/', label: 'Back to the start' }
    };
  }

  if (isRouteErrorResponse(error)) {
    return {
      slate: String(error.status),
      title: error.status === 404 ? 'Nothing on this reel' : 'That did not go through',
      body: error.statusText || 'The page you were after is not here.',
      action: { to: '/', label: 'Back to the start' }
    };
  }

  return {
    slate: 'ERR',
    title: 'Something broke mid-take',
    body: error instanceof Error ? error.message : 'An unexpected error stopped the page from loading.',
    action: { to: '/', label: 'Back to the start' }
  };
}

export default function RouteError() {
  const error = useRouteError();
  const view = readError(error);

  return (
    <div className="sc">
      <SceneBackdrop />
      <Letterbox />
      <SceneHeader />

      <main
        style={{
          display: 'grid',
          placeItems: 'center',
          minHeight: '62dvh',
          padding: '40px clamp(18px, 5vw, 76px)'
        }}
      >
        <div style={{ display: 'grid', gap: 18, maxWidth: 520, textAlign: 'center', justifyItems: 'center' }}>
          <p className="ac-eyebrow">Scene {view.slate}</p>
          <h1 className="ac-display" style={{ fontSize: 'clamp(30px, 4.6vw, 52px)' }}>
            {view.title}
          </h1>
          <p className="ac-lede">{view.body}</p>
          <Link className="ac-btn ac-btn--primary ac-btn--lg" to={view.action.to}>
            {view.action.label}
          </Link>
        </div>
      </main>
    </div>
  );
}
