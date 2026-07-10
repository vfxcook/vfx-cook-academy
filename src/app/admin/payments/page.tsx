import { formatCompactDate, getAdminPayments } from "@/lib/admin-data";
import { formatInr } from "@/lib/utils";

export default async function AdminPaymentsPage() {
  const payments = await getAdminPayments();

  return (
    <section className="card admin-operating-section">
      <div className="admin-section-heading">
        <div>
          <p>Payments</p>
          <h2>Payment Operations</h2>
        </div>
        <span className="admin-count-pill">{payments.length} requests</span>
      </div>

      <div className="admin-payment-grid">
        {payments.length === 0 ? (
          <p className="muted">No payment requests yet.</p>
        ) : (
          payments.map((payment) => (
            <article key={payment.id} className="admin-payment-row admin-payment-card">
              <div>
                <strong>{payment.user.name ?? payment.user.email ?? "Student"}</strong>
                <span>{payment.user.email ?? "No email"}</span>
                <small>{payment.user.phone ?? "No phone"}</small>
              </div>
              <div>
                <span>{payment.course.title}</span>
                <strong>{formatInr(payment.amountInr)}</strong>
              </div>
              <span className={payment.status === "APPROVED" ? "admin-badge-published" : "admin-badge-draft"}>
                {payment.status}
              </span>
              <small className="muted">Ref: {payment.transactionRef}</small>
              <small className="muted">Updated {formatCompactDate(payment.updatedAt)}</small>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
