import { useState, type FormEvent } from 'react';
import {
  Link,
  redirect,
  useLoaderData,
  useNavigate,
  useSearchParams,
  type LoaderFunctionArgs
} from 'react-router';
import { Field, Notice } from '../components/ui';
import { useSession } from './rootLayout';
import { api, errorMessage } from '../lib/api';
import { formatInr, formatRuntime } from '../lib/format';
import { openCheckout } from '../lib/razorpay';
import '../styles/course.css';

export async function checkoutLoader({ params, request }: LoaderFunctionArgs) {
  const session = await api.auth.session();
  if (!session.user) {
    const next = new URL(request.url).pathname;
    return redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  }

  const [course, config] = await Promise.all([
    api.courses.detail(params.slug!),
    api.payments.config()
  ]);
  if (course.access.hasAccess) return redirect(`/learn/${params.slug}`);

  return { ...course, config };
}

export default function Checkout() {
  const { course, config, access } = useLoaderData<typeof checkoutLoader>();
  const { user } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const isGift = params.get('gift') === '1';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [manualDone, setManualDone] = useState(false);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');

  const payNow = async () => {
    setBusy(true);
    setError('');
    try {
      const order = await api.payments.createOrder({ courseId: course.id, isGift });
      const result = await openCheckout({
        keyId: order.keyId,
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: 'VFX Cook Academy',
        description: isGift ? `Gift — ${order.courseTitle}` : order.courseTitle,
        prefill: {
          name: user?.name ?? undefined,
          email: user?.email ?? undefined,
          contact: user?.phone ?? undefined
        }
      });

      if (!result) {
        setBusy(false);
        return;
      }

      const verified = await api.payments.verify({
        courseId: course.id,
        razorpayOrderId: result.razorpay_order_id,
        razorpayPaymentId: result.razorpay_payment_id,
        razorpaySignature: result.razorpay_signature
      });
      navigate(verified.redirectTo, { replace: true });
    } catch (thrown) {
      setError(errorMessage(thrown, 'That payment did not go through.'));
      setBusy(false);
    }
  };

  const submitManual = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.payments.submitRequest({
        courseId: course.id,
        transactionRef: reference.trim(),
        note: note.trim() || undefined
      });
      setManualDone(true);
    } catch (thrown) {
      setError(errorMessage(thrown, 'Could not submit that reference.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ac-shell" style={{ paddingBottom: 'clamp(48px, 7vw, 88px)' }}>
      <div className="page-head">
        <p className="ac-eyebrow">{isGift ? 'Gift a seat' : 'Enrolment'}</p>
        <h1>{course.title}</h1>
        <p className="ac-lede">
          {isGift
            ? 'Pay once and we generate a gift code you can pass on. The person who redeems it gets full lifetime access.'
            : 'One payment, lifetime access. New lessons added to this course stay included.'}
        </p>
      </div>

      <div className="course-hero" style={{ paddingTop: 0 }}>
        <div className="ac-stack">
          {error ? <Notice tone="error">{error}</Notice> : null}

          {access.pendingPayment && !manualDone ? (
            <Notice tone="warn">
              You already have a payment under review with reference{' '}
              <span className="ac-mono">{access.pendingPayment.transactionRef}</span>. We will email
              you once it clears.
            </Notice>
          ) : null}

          {config.razorpayEnabled ? (
            <section className="ac-panel" style={{ padding: 'clamp(20px, 2.4vw, 28px)' }}>
              <p className="ac-eyebrow">Option 1 · instant</p>
              <h2 className="ac-title" style={{ fontSize: 21, margin: '6px 0 10px' }}>
                Pay by card, UPI or netbanking
              </h2>
              <p className="ac-hint" style={{ marginBottom: 16 }}>
                Access unlocks the moment the payment clears — no waiting for a review.
              </p>
              <button
                type="button"
                className="ac-btn ac-btn--primary ac-btn--lg"
                onClick={payNow}
                disabled={busy}
              >
                {busy ? 'Opening…' : `Pay ${formatInr(course.priceInr)}`}
              </button>
            </section>
          ) : null}

          <section className="ac-panel" style={{ padding: 'clamp(20px, 2.4vw, 28px)' }}>
            <p className="ac-eyebrow">
              {config.razorpayEnabled ? 'Option 2 · manual transfer' : 'Manual transfer'}
            </p>
            <h2 className="ac-title" style={{ fontSize: 21, margin: '6px 0 10px' }}>
              Pay by UPI and send us the reference
            </h2>

            {manualDone ? (
              <Notice tone="ok">
                Got it. We review transfers within a working day and email you a license code to
                unlock the course. You can track it on your{' '}
                <Link to="/dashboard">dashboard</Link>.
              </Notice>
            ) : (
              <>
                {config.qrCodeUrl ? (
                  <figure style={{ margin: '0 0 18px' }}>
                    <img
                      src={config.qrCodeUrl}
                      alt="UPI QR code for VFX Cook Academy"
                      style={{
                        width: 190,
                        borderRadius: 'var(--ac-radius-lg)',
                        border: '1px solid var(--ac-border)'
                      }}
                    />
                    <figcaption className="ac-hint" style={{ marginTop: 8 }}>
                      Scan and pay {formatInr(course.priceInr)}, then paste the UTR below.
                    </figcaption>
                  </figure>
                ) : (
                  <p className="ac-hint" style={{ marginBottom: 16 }}>
                    Transfer {formatInr(course.priceInr)} to our UPI ID, then paste the UTR or
                    transaction reference below.
                  </p>
                )}

                <form className="ac-stack" onSubmit={submitManual}>
                  <Field
                    label="UTR / transaction reference"
                    htmlFor="reference"
                    hint="The reference your bank or UPI app shows after the transfer."
                  >
                    <input
                      id="reference"
                      className="ac-input ac-mono"
                      required
                      minLength={4}
                      maxLength={100}
                      value={reference}
                      onChange={event => setReference(event.target.value)}
                      placeholder="4029XXXXXXXX"
                    />
                  </Field>

                  <Field label="Note" htmlFor="note" hint="Optional — anything we should know.">
                    <textarea
                      id="note"
                      className="ac-textarea"
                      style={{ minHeight: 76 }}
                      maxLength={250}
                      value={note}
                      onChange={event => setNote(event.target.value)}
                    />
                  </Field>

                  <button type="submit" className="ac-btn ac-btn--ghost ac-btn--lg" disabled={busy}>
                    {busy ? 'Sending…' : 'Submit for review'}
                  </button>
                </form>
              </>
            )}
          </section>

          <p className="ac-hint">
            Have a gift code instead? <Link to="/gift/redeem">Redeem it here</Link>.
          </p>
        </div>

        <aside className="ac-panel course-buy">
          <p className="ac-eyebrow">Order summary</p>

          {course.thumbnailUrl ? (
            <div className="ac-media-frame" style={{ aspectRatio: '16 / 10' }}>
              <img
                src={course.thumbnailUrl}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          ) : null}

          <div>
            <strong style={{ fontSize: 15 }}>{course.title}</strong>
            <p className="ac-hint" style={{ marginTop: 6 }}>
              {course.lessonCount} lessons · {formatRuntime(course.totalDurationSec)}
            </p>
          </div>

          <div className="course-buy-price">
            <b>{formatInr(course.priceInr)}</b>
            <span>one-time</span>
          </div>

          {isGift ? (
            <Notice tone="ok">
              This is a gift purchase. You get a code to share, not the course access.
            </Notice>
          ) : (
            <Link className="ac-btn ac-btn--quiet ac-btn--sm" to={`/checkout/${course.slug}?gift=1`}>
              Buying this for someone else?
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
