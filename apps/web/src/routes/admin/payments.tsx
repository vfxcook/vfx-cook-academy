import { useMemo, useState } from 'react';
import { useLoaderData, useRevalidator } from 'react-router';
import { Dialog, EmptyState, Notice } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { formatInr, formatRelative } from '../../lib/format';

export async function adminPaymentsLoader() {
  return api.admin.payments();
}

type Filter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'PENDING', label: 'Awaiting review' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'REJECTED', label: 'Rejected' },
  { id: 'ALL', label: 'Everything' }
];

export default function AdminPayments() {
  const { payments } = useLoaderData<typeof adminPaymentsLoader>();
  const revalidator = useRevalidator();

  const [filter, setFilter] = useState<Filter>('PENDING');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [issued, setIssued] = useState<{ code: string; emailed: boolean; email: string } | null>(null);

  const visible = useMemo(
    () => payments.filter(payment => filter === 'ALL' || payment.status === filter),
    [payments, filter]
  );

  const act = async (id: string, action: 'approve' | 'reject', email: string) => {
    setBusy(id);
    setError('');
    try {
      if (action === 'approve') {
        const result = await api.admin.approvePayment(id);
        setIssued({ code: result.licenseCode, emailed: result.emailed, email });
      } else {
        await api.admin.rejectPayment(id);
      }
      revalidator.revalidate();
    } catch (thrown) {
      setError(errorMessage(thrown, 'That action did not go through.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="page-head" style={{ paddingTop: 0 }}>
        <p className="ac-eyebrow">Admin</p>
        <h1>Payments</h1>
        <p className="ac-lede">
          Approving a manual transfer issues a one-time license code and emails it to the student.
          Gateway payments unlock on their own and appear here already approved.
        </p>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="ac-row" role="tablist" aria-label="Filter payments">
        {FILTERS.map(item => {
          const count = payments.filter(p => item.id === 'ALL' || p.status === item.id).length;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              className={`ac-btn ac-btn--sm ${filter === item.id ? 'ac-btn--ghost' : 'ac-btn--quiet'}`}
              onClick={() => setFilter(item.id)}
            >
              {item.label} ({count})
            </button>
          );
        })}
      </div>

      <section className="ac-panel adm-card">
        {visible.length === 0 ? (
          <EmptyState title="Nothing here">
            {filter === 'PENDING' ? 'No payments are waiting on you.' : 'No payments in this state.'}
          </EmptyState>
        ) : (
          <div className="ac-table-wrap">
            <table className="ac-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Course</th>
                  <th>Amount</th>
                  <th>Reference</th>
                  <th>Status</th>
                  <th>When</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map(payment => (
                  <tr key={payment.id}>
                    <td>
                      {payment.user.name ?? '—'}
                      <div className="adm-mini">{payment.user.email}</div>
                      {payment.user.phone ? <div className="adm-mini">{payment.user.phone}</div> : null}
                    </td>
                    <td>
                      {payment.course.title}
                      {payment.isGift ? (
                        <div>
                          <span className="ac-chip ac-chip--ember">Gift</span>
                        </div>
                      ) : null}
                    </td>
                    <td>{formatInr(payment.amountInr)}</td>
                    <td>
                      <span className="ac-mono">{payment.transactionRef}</span>
                      {payment.note ? <div className="adm-mini">{payment.note}</div> : null}
                    </td>
                    <td>
                      <span
                        className={`ac-chip ${
                          payment.status === 'APPROVED'
                            ? 'ac-chip--ok'
                            : payment.status === 'REJECTED'
                              ? 'ac-chip--danger'
                              : 'ac-chip--warn'
                        }`}
                      >
                        {payment.status.toLowerCase()}
                      </span>
                      {payment.reviewedBy ? (
                        <div className="adm-mini">by {payment.reviewedBy}</div>
                      ) : null}
                    </td>
                    <td>{formatRelative(payment.createdAt)}</td>
                    <td>
                      {payment.status === 'PENDING' ? (
                        <div className="ac-row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="ac-btn ac-btn--primary ac-btn--sm"
                            disabled={busy === payment.id}
                            onClick={() => act(payment.id, 'approve', payment.user.email ?? '')}
                          >
                            {busy === payment.id ? '…' : 'Approve'}
                          </button>
                          <button
                            type="button"
                            className="ac-btn ac-btn--quiet ac-btn--sm"
                            disabled={busy === payment.id}
                            onClick={() => act(payment.id, 'reject', payment.user.email ?? '')}
                          >
                            Reject
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {issued ? (
        <Dialog title="License issued" onClose={() => setIssued(null)}>
          <p className="ac-lede" style={{ marginBottom: 16 }}>
            {issued.emailed
              ? `The code has been emailed to ${issued.email}. It is valid for 7 days.`
              : 'SMTP is not configured, so the email was not sent. Pass this code on yourself — it is valid for 7 days.'}
          </p>
          <p className="adm-code">{issued.code}</p>
          <div className="ac-row" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
            <button
              type="button"
              className="ac-btn ac-btn--ghost"
              onClick={() => void navigator.clipboard.writeText(issued.code).catch(() => undefined)}
            >
              Copy code
            </button>
            <button type="button" className="ac-btn ac-btn--primary" onClick={() => setIssued(null)}>
              Done
            </button>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
