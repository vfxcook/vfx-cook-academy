import { useEffect } from 'react';
import { api } from '../lib/api';
import { loadGoogleIdentity, randomNonce, type GoogleCredentialResponse } from '../lib/googleIdentity';

/**
 * Google One Tap for signed-out visitors. BrahmAstra Studio and the Academy share one
 * Google client, so someone already signed in to Google on brahmastra.studio is offered —
 * or, having used it before, automatically given — a session here. It keeps them on the
 * page they came for; the header and calls to action pick up their access after reload.
 */
export default function GoogleOneTap({ clientId }: { clientId: string }) {
  useEffect(() => {
    let cancelled = false;
    const nonce = randomNonce();

    const handleCredential = async (response: GoogleCredentialResponse) => {
      if (!response?.credential || cancelled) return;
      try {
        await api.auth.google({ credential: response.credential, nonce });
        window.location.reload();
      } catch {
        // One Tap is a convenience; the sign-in page remains the explicit path.
      }
    };

    loadGoogleIdentity()
      .then(google => {
        if (cancelled) return;
        google.initialize({
          client_id: clientId,
          callback: handleCredential,
          nonce,
          context: 'signin',
          auto_select: true,
          cancel_on_tap_outside: true,
          itp_support: true,
          use_fedcm_for_prompt: true
        });
        google.prompt();
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      window.google?.accounts?.id?.cancel();
    };
  }, [clientId]);

  return null;
}
