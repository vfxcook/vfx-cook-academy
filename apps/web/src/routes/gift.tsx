import { useState, type FormEvent } from 'react';
import { Link, redirect, useLoaderData, useNavigate, useSearchParams, type LoaderFunctionArgs } from 'react-router';
import { Field, Notice } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { formatDate, formatInr } from '../lib/format';

export async function giftLoader({ params }: LoaderFunctionArgs) {
  const session = await api.auth.session();
  if (!session.user) return redirect(`/sign-in?next=${encodeURIComponent(`/gift/${params.id}`)}`);
  return api.payments.gift(params.id!);
}

export function GiftSuccess() {
  const { gift } = useLoaderData<typeof giftLoader>();
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  const copy = async (value: string, which: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard access can be refused; the value is on screen to copy by hand.
    }
  };

  return (
    <div className="ac-shell" style={{ paddingBottom: 'clamp(48px, 7vw, 88px)', maxWidth: 720 }}>
      <div className="page-head">
        <p className="ac-eyebrow">Gift ready</p>
        <h1>A seat in {gift.course.title}</h1>
        <p className="ac-lede">
          Send this code to whoever you are gifting it to. They redeem it on the Academy and get
          lifetime access to the course.
        </p>
      </div>

      <div className="ac-panel" style={{ padding: 'clamp(22px, 3vw, 32px)', display: 'grid', gap: 18 }}>
        <div>
          <p className="ac-label">Gift code</p>
          <p
            className="ac-mono"
            style={{
              fontSize: 22,
              letterSpacing: '0.1em',
              margin: '8px 0 0',
              color: 'var(--ac-ember)'
            }}
          >
            {gift.code}
          </p>
        </div>

        <div className="ac-row">
          <button type="button" className="ac-btn ac-btn--primary" onClick={() => copy(gift.code, 'code')}>
            {copied === 'code' ? 'Copied' : 'Copy code'}
          </button>
          <button type="button" className="ac-btn ac-btn--ghost" onClick={() => copy(gift.redeemUrl, 'link')}>
            {copied === 'link' ? 'Copied' : 'Copy redeem link'}
          </button>
        </div>

        <div className="ac-table-wrap">
          <table className="ac-table" style={{ minWidth: 0 }}>
            <tbody>
              <tr>
                <th>Course</th>
                <td>{gift.course.title}</td>
              </tr>
              <tr>
                <th>Paid</th>
                <td>{formatInr(gift.amountInr)}</td>
              </tr>
              <tr>
                <th>Bought</th>
                <td>{formatDate(gift.createdAt)}</td>
              </tr>
              <tr>
                <th>Status</th>
                <td>
                  <span className={`ac-chip ${gift.isRedeemed ? 'ac-chip--ok' : 'ac-chip--ember'}`}>
                    {gift.isRedeemed ? `Redeemed ${formatDate(gift.redeemedAt)}` : 'Not redeemed yet'}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <Link className="ac-btn ac-btn--quiet ac-btn--sm" to="/dashboard">
          Back to my classroom
        </Link>
      </div>
    </div>
  );
}

export async function giftRedeemLoader({ request }: LoaderFunctionArgs) {
  const session = await api.auth.session();
  if (!session.user) {
    const url = new URL(request.url);
    return redirect(`/sign-in?next=${encodeURIComponent(url.pathname + url.search)}`);
  }
  return null;
}

export function GiftRedeem() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [code, setCode] = useState(params.get('code') ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api.payments.redeemGift(code.trim());
      navigate(result.redirectTo, { replace: true });
    } catch (thrown) {
      setError(errorMessage(thrown, 'That code could not be redeemed.'));
      setBusy(false);
    }
  };

  return (
    <div className="ac-shell" style={{ paddingBottom: 'clamp(48px, 7vw, 88px)', maxWidth: 560 }}>
      <div className="page-head">
        <p className="ac-eyebrow">Gift</p>
        <h1>Redeem your code</h1>
        <p className="ac-lede">
          Enter the code you were sent and the course unlocks on your account straight away.
        </p>
      </div>

      <form className="ac-panel ac-stack" style={{ padding: 'clamp(20px, 2.6vw, 30px)' }} onSubmit={submit}>
        {error ? <Notice tone="error">{error}</Notice> : null}

        <Field label="Gift code" htmlFor="gift-code">
          <input
            id="gift-code"
            className="ac-input ac-mono"
            style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
            required
            minLength={6}
            value={code}
            onChange={event => setCode(event.target.value)}
            placeholder="GIFT-XXXXXXXX-XXXX"
          />
        </Field>

        <button type="submit" className="ac-btn ac-btn--primary ac-btn--lg ac-btn--block" disabled={busy}>
          {busy ? 'Checking…' : 'Redeem and open the course'}
        </button>
      </form>
    </div>
  );
}
