import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { api, errorMessage } from '../lib/api';
import { loadGoogleIdentity, randomNonce, type GoogleCredentialResponse } from '../lib/googleIdentity';
import type { GoogleSignInResult } from '../lib/types';

type Phase = 'loading' | 'ready' | 'unavailable' | 'verifying';

interface GoogleSignInProps {
  clientId: string;
  mode: 'signin' | 'signup';
  /** Offer One Tap on arrival, so a returning BrahmAstra user signs in with one tap. */
  autoPrompt: boolean;
  onSignedIn: (result: GoogleSignInResult) => void;
  onError: (message: string) => void;
}

const LABELS: Record<GoogleSignInProps['mode'], string> = {
  signin: 'Continue with Google',
  signup: 'Sign up with Google'
};

/**
 * Sign in with Google through Google Identity Services. Our styled button sits underneath
 * Google's own rendered button, which is stretched invisibly over it: the click is always
 * Google's, so the flow stays inside the official SDK while the look stays ours.
 */
export default function GoogleSignIn({ clientId, mode, autoPrompt, onSignedIn, onError }: GoogleSignInProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const nonceRef = useRef('');
  const latestRef = useRef({ onSignedIn, onError });
  const [phase, setPhase] = useState<Phase>('loading');
  const [attempt, setAttempt] = useState(0);

  latestRef.current = { onSignedIn, onError };

  const stretch = useCallback(() => {
    const wrap = wrapRef.current;
    const rendered = mountRef.current?.firstElementChild as HTMLElement | null;
    const clickable = mountRef.current?.querySelector<HTMLElement>('[role="button"]');
    if (!wrap || !rendered || !clickable) return;
    const { offsetWidth: width, offsetHeight: height } = clickable;
    if (!width || !height || !wrap.offsetWidth) return;
    const transform = `scale(${(wrap.offsetWidth / width).toFixed(4)}, ${(wrap.offsetHeight / height).toFixed(4)})`;
    if (rendered.dataset.gsScale !== transform) {
      rendered.dataset.gsScale = transform;
      rendered.style.transformOrigin = '0 0';
      rendered.style.transform = transform;
    }
  }, []);

  const draw = useCallback(() => {
    const wrap = wrapRef.current;
    const mount = mountRef.current;
    const google = window.google?.accounts?.id;
    if (!wrap || !mount || !google) return;
    const width = Math.round(wrap.getBoundingClientRect().width);
    if (!width) return;
    mount.innerHTML = '';
    google.renderButton(mount, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'rectangular',
      text: mode === 'signup' ? 'signup_with' : 'continue_with',
      logo_alignment: 'center',
      width: Math.min(width, 400)
    });
    stretch();
  }, [mode, stretch]);

  useEffect(() => {
    let cancelled = false;

    const handleCredential = async (response: GoogleCredentialResponse) => {
      if (!response?.credential || cancelled) return;
      setPhase('verifying');
      try {
        const result = await api.auth.google({ credential: response.credential, nonce: nonceRef.current });
        if (!cancelled) latestRef.current.onSignedIn(result);
      } catch (error) {
        if (cancelled) return;
        latestRef.current.onError(errorMessage(error, 'Google sign-in did not complete. Try again.'));
        setAttempt(value => value + 1);
      }
    };

    setPhase('loading');
    (async () => {
      try {
        const google = await loadGoogleIdentity();
        if (cancelled) return;
        nonceRef.current = randomNonce();
        google.initialize({
          client_id: clientId,
          callback: handleCredential,
          nonce: nonceRef.current,
          context: mode === 'signup' ? 'signup' : 'signin',
          ux_mode: 'popup',
          auto_select: autoPrompt && attempt === 0,
          cancel_on_tap_outside: true,
          itp_support: true,
          use_fedcm_for_prompt: true
        });
        setPhase('ready');
        requestAnimationFrame(draw);
        if (autoPrompt && attempt === 0) google.prompt();
      } catch (error) {
        if (cancelled) return;
        latestRef.current.onError(errorMessage(error, 'Google sign-in could not load.'));
        setPhase('unavailable');
      }
    })();

    return () => {
      cancelled = true;
      window.google?.accounts?.id?.cancel();
    };
  }, [clientId, mode, autoPrompt, attempt, draw]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const mount = mountRef.current;
    if (phase !== 'ready' || !wrap || !mount) return;

    const mutations = new MutationObserver(() => stretch());
    mutations.observe(mount, { childList: true, subtree: true, attributes: true });

    let lastWidth = Math.round(wrap.getBoundingClientRect().width);
    let timer = 0;
    const resize = new ResizeObserver(() => {
      const width = Math.round(wrap.getBoundingClientRect().width);
      if (width === lastWidth) return;
      lastWidth = width;
      window.clearTimeout(timer);
      timer = window.setTimeout(draw, 160);
    });
    resize.observe(wrap);

    return () => {
      mutations.disconnect();
      resize.disconnect();
      window.clearTimeout(timer);
    };
  }, [phase, draw, stretch]);

  const retry = () => {
    if (phase !== 'unavailable') return;
    onError('');
    setAttempt(value => value + 1);
  };

  const track = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--gx', `${event.clientX - box.left}px`);
    event.currentTarget.style.setProperty('--gy', `${event.clientY - box.top}px`);
  };

  const busy = phase === 'verifying' || phase === 'loading';
  const label =
    phase === 'verifying'
      ? 'Verifying your Google account…'
      : phase === 'loading'
        ? 'Connecting to Google…'
        : phase === 'unavailable'
          ? 'Google unavailable — tap to retry'
          : LABELS[mode];

  return (
    <div ref={wrapRef} className="gs-wrap" data-phase={phase} onPointerMove={track}>
      <button type="button" className="gs-button" onClick={retry} disabled={busy} aria-busy={busy}>
        <span className="gs-sheen" aria-hidden="true" />
        <span className="gs-mark" aria-hidden="true">
          {busy ? (
            <span className="gs-spinner" />
          ) : (
            <svg viewBox="0 0 48 48">
              <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.1z" />
              <path fill="#34A853" d="M24 46c6 0 11-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.6-3.9-12.3-9.1H4.4v5.7C7.9 41 15.4 46 24 46z" />
              <path fill="#FBBC05" d="M11.7 28.1c-.4-1.3-.7-2.7-.7-4.1s.2-2.8.7-4.1v-5.7H4.4C2.9 17.1 2 20.4 2 24s.9 6.9 2.4 9.8l7.3-5.7z" />
              <path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.1 30 2 24 2 15.4 2 7.9 7 4.4 14.2l7.3 5.7c1.7-5.2 6.6-9.1 12.3-9.1z" />
            </svg>
          )}
        </span>
        <span className="gs-label" aria-live="polite">
          {label}
        </span>
        <span className="gs-arrow" aria-hidden="true">
          →
        </span>
      </button>
      <div ref={mountRef} className="gs-overlay" aria-hidden={phase !== 'ready'} />
    </div>
  );
}
