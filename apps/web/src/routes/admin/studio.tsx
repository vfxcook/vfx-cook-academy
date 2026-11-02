import { useState, type FormEvent } from 'react';
import { useLoaderData, useRevalidator } from 'react-router';
import { Field, Notice } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { formatInr, formatRelative } from '../../lib/format';

export async function adminStudioLoader() {
  return api.admin.studio();
}

export default function AdminStudio() {
  const data = useLoaderData<typeof adminStudioLoader>();
  const revalidator = useRevalidator();

  const { packs, models, purchases, generations } = data;

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const keySetting = data.settings.find(setting => setting.key === 'KIE_API_KEY');

  const saveKey = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const value = String(new FormData(form).get('value') ?? '').trim();
    if (!value) return;

    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api.admin.saveStudioSetting('KIE_API_KEY', value);
      setMessage('Provider key saved.');
      form.reset();
      revalidator.revalidate();
    } catch (thrown) {
      setError(errorMessage(thrown, 'Could not save that key.'));
    } finally {
      setBusy(false);
    }
  };

  const allocate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const body = new FormData(form);

    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await api.admin.allocateCredits({
        email: String(body.get('email') ?? ''),
        credits: Number(body.get('credits') ?? 0),
        note: String(body.get('note') ?? '') || undefined
      });
      setMessage(`Done. New balance: ${result.balance} credits.`);
      form.reset();
    } catch (thrown) {
      setError(errorMessage(thrown, 'Could not adjust those credits.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head" style={{ paddingTop: 0 }}>
        <p className="ac-eyebrow">Admin</p>
        <h1>AI Studio</h1>
        <p className="ac-lede">
          Provider credentials, credit packs and what students are spending.
        </p>
      </div>

      {message ? <Notice tone="ok">{message}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      <section className="ac-panel adm-card">
        <div className="adm-card-head">
          <h2>Provider key</h2>
          <span className={`ac-chip ${keySetting?.hasValue ? 'ac-chip--ok' : 'ac-chip--warn'}`}>
            {keySetting?.hasValue ? 'configured' : 'not set'}
          </span>
        </div>

        <form onSubmit={saveKey} className="ac-row" style={{ alignItems: 'flex-end', gap: 12 }}>
          <div style={{ flex: '1 1 260px', minWidth: 220 }}>
            <Field
              label="KIE API key"
              htmlFor="kie-key"
              hint={
                keySetting?.hasValue
                  ? `Stored. Last updated ${formatRelative(keySetting.updatedAt)}. Entering a new value replaces it.`
                  : 'Falls back to the KIE_API_KEY environment variable when empty.'
              }
            >
              <input
                id="kie-key"
                name="value"
                className="ac-input ac-mono"
                type="password"
                autoComplete="off"
                placeholder="sk-…"
              />
            </Field>
          </div>
          <button type="submit" className="ac-btn ac-btn--primary" disabled={busy}>
            Save key
          </button>
        </form>
      </section>

      <section className="ac-panel adm-card">
        <div className="adm-card-head">
          <h2>Adjust a student's credits</h2>
        </div>

        <form onSubmit={allocate} className="adm-form-grid">
          <Field label="Student email" htmlFor="alloc-email">
            <input id="alloc-email" name="email" className="ac-input" type="email" required />
          </Field>

          <Field label="Credits" htmlFor="alloc-credits" hint="Negative numbers deduct.">
            <input id="alloc-credits" name="credits" className="ac-input" type="number" required />
          </Field>

          <Field label="Note" htmlFor="alloc-note" hint="Shows in the student's ledger.">
            <input id="alloc-note" name="note" className="ac-input" maxLength={250} />
          </Field>

          <div className="adm-span ac-row" style={{ justifyContent: 'flex-end' }}>
            <button type="submit" className="ac-btn ac-btn--ember" disabled={busy}>
              {busy ? 'Working…' : 'Apply adjustment'}
            </button>
          </div>
        </form>
      </section>

      <section className="ac-panel adm-card">
        <div className="adm-card-head">
          <h2>Credit packs</h2>
          <span className="adm-mini">Prices are derived from provider cost plus margin.</span>
        </div>
        <div className="ac-table-wrap">
          <table className="ac-table">
            <thead>
              <tr>
                <th>Pack</th>
                <th>Credits</th>
                <th>Price</th>
                <th>Provider cost</th>
                <th>Margin</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {packs.map(pack => (
                <tr key={pack.id}>
                  <td>{pack.name}</td>
                  <td className="ac-mono">{pack.credits.toLocaleString('en-IN')}</td>
                  <td>{formatInr(pack.amountInr)}</td>
                  <td>{formatInr(pack.providerCostInr)}</td>
                  <td>{formatInr(pack.amountInr - pack.providerCostInr)}</td>
                  <td>
                    <span className={`ac-chip ${pack.isActive ? 'ac-chip--ok' : 'ac-chip--warn'}`}>
                      {pack.isActive ? 'active' : 'off'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ac-panel adm-card">
        <div className="adm-card-head">
          <h2>Models</h2>
        </div>
        <div className="ac-table-wrap">
          <table className="ac-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Category</th>
                <th>Credits per run</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {models.map(model => (
                <tr key={model.id}>
                  <td>{model.displayName}</td>
                  <td>{model.category}</td>
                  <td className="ac-mono">{model.providerCredits}</td>
                  <td>
                    <span className={`ac-chip ${model.isEnabled ? 'ac-chip--ok' : 'ac-chip--warn'}`}>
                      {model.isEnabled ? 'enabled' : 'off'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {purchases.length > 0 ? (
        <section className="ac-panel adm-card">
          <div className="adm-card-head">
            <h2>Recent purchases</h2>
          </div>
          <div className="ac-table-wrap">
            <table className="ac-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Pack</th>
                  <th>Credits</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map(purchase => (
                  <tr key={purchase.id}>
                    <td>
                      {purchase.user.name ?? '—'}
                      <div className="adm-mini">{purchase.user.email}</div>
                    </td>
                    <td>{purchase.pack?.name ?? '—'}</td>
                    <td className="ac-mono">{purchase.credits}</td>
                    <td>{formatInr(purchase.amountInr)}</td>
                    <td>
                      <span className={`ac-chip ${purchase.status === 'PAID' ? 'ac-chip--ok' : 'ac-chip--warn'}`}>
                        {purchase.status.toLowerCase()}
                      </span>
                    </td>
                    <td>{formatRelative(purchase.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {generations.length > 0 ? (
        <section className="ac-panel adm-card">
          <div className="adm-card-head">
            <h2>Recent generations</h2>
          </div>
          <div className="ac-table-wrap">
            <table className="ac-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Model</th>
                  <th>Prompt</th>
                  <th>Credits</th>
                  <th>Status</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {generations.map(generation => (
                  <tr key={generation.id}>
                    <td>
                      {generation.user.name ?? '—'}
                      <div className="adm-mini">{generation.user.email}</div>
                    </td>
                    <td>{generation.modelPricing?.displayName ?? '—'}</td>
                    <td style={{ maxWidth: 300 }}>
                      <span className="adm-mini">{generation.prompt.slice(0, 120)}</span>
                    </td>
                    <td className="ac-mono">{generation.creditsCharged}</td>
                    <td>
                      <span
                        className={`ac-chip ${
                          generation.status === 'SUCCEEDED'
                            ? 'ac-chip--ok'
                            : generation.status === 'RUNNING' || generation.status === 'QUEUED'
                              ? 'ac-chip--ember'
                              : 'ac-chip--danger'
                        }`}
                      >
                        {generation.status.toLowerCase()}
                      </span>
                    </td>
                    <td>{formatRelative(generation.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}
