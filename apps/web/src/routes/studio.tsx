import { useEffect, useRef, useState, type FormEvent } from 'react';
import { redirect, useLoaderData, useRevalidator } from 'react-router';
import { Notice } from '../components/ui';
import { useSession } from './rootLayout';
import { api, errorMessage } from '../lib/api';
import { formatInr, formatRelative } from '../lib/format';
import { openCheckout } from '../lib/razorpay';
import type { StudioGeneration } from '../lib/types';
import '../styles/studio.css';

export async function studioLoader() {
  const session = await api.auth.session();
  if (!session.user) return redirect('/sign-in?next=%2Fstudio');

  const [overview, config] = await Promise.all([api.studio.overview(), api.payments.config()]);
  return { ...overview, config };
}

const STATUS_TONE: Record<StudioGeneration['status'], string> = {
  QUEUED: 'ac-chip--warn',
  RUNNING: 'ac-chip--ember',
  SUCCEEDED: 'ac-chip--ok',
  FAILED: 'ac-chip--danger',
  REFUNDED: 'ac-chip--danger'
};

export default function Studio() {
  const data = useLoaderData<typeof studioLoader>();
  const { user } = useSession();
  const revalidator = useRevalidator();

  const [balance, setBalance] = useState(data.balance.availableCredits);
  const [generations, setGenerations] = useState(data.generations);
  const [modelId, setModelId] = useState(data.models[0]?.providerModelId ?? '');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [buying, setBuying] = useState<string | null>(null);

  const model = data.models.find(item => item.providerModelId === modelId);
  const cost = model?.providerCredits ?? 0;
  const affordable = balance >= cost;

  // Queued and running jobs finish on a provider callback, so poll while any are open.
  const pending = generations.some(item => item.status === 'QUEUED' || item.status === 'RUNNING');
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(async () => {
      if (!pendingRef.current) return;
      try {
        const fresh = await api.studio.generations();
        setGenerations(fresh.generations);
        setBalance(fresh.balance.availableCredits);
      } catch {
        // A dropped poll is harmless; the next tick tries again.
      }
    }, 6000);
    return () => window.clearInterval(timer);
  }, [pending]);

  const generate = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api.studio.generate({ providerModelId: modelId, prompt: prompt.trim() });
      setBalance(result.balance);
      setPrompt('');
      const fresh = await api.studio.generations();
      setGenerations(fresh.generations);
    } catch (thrown) {
      setError(errorMessage(thrown, 'Could not start that generation.'));
    } finally {
      setBusy(false);
    }
  };

  const buyPack = async (packId: string) => {
    setBuying(packId);
    setError('');
    try {
      const order = await api.studio.createCreditOrder(packId);
      const result = await openCheckout({
        keyId: order.keyId,
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: data.brand,
        description: order.description,
        prefill: {
          name: user?.name ?? undefined,
          email: user?.email ?? undefined,
          contact: user?.phone ?? undefined
        }
      });

      if (!result) return;

      const verified = await api.studio.verifyCredits({
        razorpayOrderId: result.razorpay_order_id,
        razorpayPaymentId: result.razorpay_payment_id,
        razorpaySignature: result.razorpay_signature
      });
      setBalance(verified.balance);
      revalidator.revalidate();
    } catch (thrown) {
      setError(errorMessage(thrown, 'That purchase did not complete.'));
    } finally {
      setBuying(null);
    }
  };

  return (
    <div className="ac-shell" style={{ paddingBottom: 'clamp(48px, 7vw, 88px)' }}>
      <div className="page-head">
        <p className="ac-eyebrow">{data.brand}</p>
        <h1>Practice on real models</h1>
        <p className="ac-lede">
          Run the prompts you write in class against production image and video models. Credits are
          charged when a job starts and returned automatically if the provider fails.
        </p>
      </div>

      <div className="studio-grid">
        <div className="ac-stack">
          {error ? <Notice tone="error">{error}</Notice> : null}

          <form className="ac-composer studio-composer" onSubmit={generate}>
            <textarea
              className="studio-prompt"
              value={prompt}
              maxLength={5000}
              onChange={event => setPrompt(event.target.value)}
              placeholder="A night market in Fort Kochi, 50mm, shallow depth, practical lanterns as key, slow dolly in…"
              aria-label="Prompt"
            />

            <div className="studio-composer-foot">
              <div className="ac-select-wrap" style={{ minWidth: 190 }}>
                <select
                  className="ac-select"
                  value={modelId}
                  onChange={event => setModelId(event.target.value)}
                  aria-label="Model"
                >
                  {data.models.map(item => (
                    <option key={item.id} value={item.providerModelId}>
                      {item.displayName} · {item.providerCredits} cr
                    </option>
                  ))}
                </select>
              </div>

              <span className="ac-spacer" />

              <span className={`ac-chip ${affordable ? 'ac-chip--ember' : 'ac-chip--danger'}`}>
                {cost} credits
              </span>

              <button
                type="submit"
                className="ac-btn ac-btn--primary"
                disabled={busy || !affordable || prompt.trim().length < 3 || !modelId}
              >
                {busy ? 'Queueing…' : 'Generate'}
              </button>
            </div>
          </form>

          {!affordable ? (
            <Notice tone="warn">
              This model costs {cost} credits and you have {balance}. Top up on the right to keep
              going.
            </Notice>
          ) : null}

          <section aria-labelledby="gens-heading">
            <div className="ac-between" style={{ marginBottom: 14 }}>
              <h2 id="gens-heading" className="ac-title" style={{ fontSize: 20 }}>
                Your generations
              </h2>
              {pending ? <span className="ac-chip ac-chip--ember">Working…</span> : null}
            </div>

            {generations.length === 0 ? (
              <Notice>Nothing generated yet. Your first render will appear here.</Notice>
            ) : (
              <div className="studio-gens">
                {generations.map(generation => (
                  <article key={generation.id} className="ac-panel studio-gen">
                    {generation.outputUrl ? (
                      <a
                        className="ac-media-frame studio-gen-media"
                        href={generation.outputUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        {generation.modelPricing?.category === 'Video' ? (
                          <video src={generation.outputUrl} controls playsInline preload="metadata" />
                        ) : (
                          <img src={generation.outputUrl} alt={generation.prompt.slice(0, 80)} loading="lazy" />
                        )}
                      </a>
                    ) : (
                      <div className="ac-media-frame studio-gen-media studio-gen-empty">
                        <span className="ac-mono">{generation.status}</span>
                      </div>
                    )}

                    <div className="studio-gen-body">
                      <div className="ac-row" style={{ gap: 6 }}>
                        <span className={`ac-chip ${STATUS_TONE[generation.status]}`}>
                          {generation.status.toLowerCase()}
                        </span>
                        {generation.modelPricing ? (
                          <span className="ac-chip">{generation.modelPricing.displayName}</span>
                        ) : null}
                        <span className="ac-chip">{generation.creditsCharged} cr</span>
                      </div>

                      <p className="studio-gen-prompt">{generation.prompt}</p>

                      {generation.errorMessage ? (
                        <p className="ac-error">{generation.errorMessage}</p>
                      ) : null}

                      <time className="ac-mono ac-muted" dateTime={generation.createdAt}>
                        {formatRelative(generation.createdAt)}
                      </time>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="studio-side">
          <div className="ac-panel studio-balance">
            <p className="ac-eyebrow">Balance</p>
            <b>{balance.toLocaleString('en-IN')}</b>
            <span>credits available</span>
            <div className="studio-balance-split">
              <span>
                <i>{data.balance.lifetimePurchasedCredits.toLocaleString('en-IN')}</i> bought
              </span>
              <span>
                <i>{data.balance.lifetimeUsedCredits.toLocaleString('en-IN')}</i> used
              </span>
            </div>
          </div>

          {data.config.razorpayEnabled ? (
            <div className="ac-panel studio-packs">
              <p className="ac-eyebrow">Top up</p>
              {data.packs.map(pack => (
                <button
                  key={pack.id}
                  type="button"
                  className="studio-pack"
                  onClick={() => buyPack(pack.id)}
                  disabled={buying !== null}
                >
                  <span>
                    <strong>{pack.name}</strong>
                    <small>{pack.credits.toLocaleString('en-IN')} credits</small>
                  </span>
                  <b>{buying === pack.id ? '…' : formatInr(pack.amountInr)}</b>
                </button>
              ))}
            </div>
          ) : (
            <Notice>Credit top-ups are not switched on yet. Ask the team for an allocation.</Notice>
          )}

          {data.ledger.length > 0 ? (
            <div className="ac-panel studio-ledger">
              <p className="ac-eyebrow">Recent activity</p>
              {data.ledger.map(entry => (
                <div key={entry.id} className="studio-ledger-row">
                  <span>
                    <strong>{entry.note ?? entry.type.replace(/_/g, ' ').toLowerCase()}</strong>
                    <time dateTime={entry.createdAt}>{formatRelative(entry.createdAt)}</time>
                  </span>
                  <b data-negative={entry.deltaCredits < 0 || undefined}>
                    {entry.deltaCredits > 0 ? '+' : ''}
                    {entry.deltaCredits}
                  </b>
                </div>
              ))}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
