/*
 * Google Identity Services — Google's standard browser SDK for Sign in with Google and One
 * Tap. It issues an ID token for the BrahmAstra client; the API verifies it server-side.
 */

const DEFAULT_GOOGLE_CLIENT_ID = '706720560213-1f3dmo50amk180u2a7o6qcuqh2hm435i.apps.googleusercontent.com';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

/** The server's configured client wins, so web and API can never disagree about it. */
export function resolveGoogleClientId(fromServer?: string | null) {
  return fromServer || import.meta.env.VITE_GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID;
}

export interface GoogleCredentialResponse {
  credential?: string;
  select_by?: string;
}

interface GoogleButtonOptions {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  logo_alignment?: 'left' | 'center';
  width?: number;
}

export interface GoogleIdApi {
  initialize: (config: Record<string, unknown>) => void;
  renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void;
  prompt: () => void;
  cancel: () => void;
  disableAutoSelect: () => void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdApi } };
  }
}

let loading: Promise<GoogleIdApi> | null = null;

export function loadGoogleIdentity(): Promise<GoogleIdApi> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);

  loading ??= new Promise<GoogleIdApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const google = window.google?.accounts?.id;
      if (google) resolve(google);
      else reject(new Error('Google sign-in did not start. Refresh and try again.'));
    };
    script.onerror = () => {
      script.remove();
      reject(new Error('Google sign-in could not load. Check your connection, or allow accounts.google.com in your blocker.'));
    };
    document.head.appendChild(script);
  });

  // A failed load is retried on the next call instead of being cached forever.
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

/** Binds a Google token to the sign-in this browser started, so it cannot be replayed. */
export function randomNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** After sign-out, stop One Tap from silently signing the same account straight back in. */
export function forgetGoogleAccount() {
  try {
    window.google?.accounts?.id?.cancel();
    window.google?.accounts?.id?.disableAutoSelect();
  } catch {
    // Nothing to forget if Google never loaded on this page.
  }
}
