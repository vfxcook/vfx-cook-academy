import { redirect, type LoaderFunctionArgs } from 'react-router';
import { api } from '../lib/api';
import { explicitNext } from './signIn';

/**
 * Lands from the emailed link, exchanges the token for a session, then hands off.
 * Errors come back on /sign-in rather than dead-ending on a blank screen.
 */
export async function signInLinkLoader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const email = url.searchParams.get('email');
  const token = url.searchParams.get('token');
  const next = explicitNext(url.searchParams);

  if (!email || !token) {
    return redirect('/sign-in?error=That%20link%20is%20incomplete.%20Request%20a%20new%20one.');
  }

  try {
    const result = await api.auth.consumeLoginLink({ email, token });
    return redirect(next ?? result.redirectTo);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'That link is no longer valid.';
    return redirect(`/sign-in?error=${encodeURIComponent(message)}`);
  }
}

export default function SignInLink() {
  return null;
}
