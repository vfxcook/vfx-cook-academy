import Link from "next/link";

import { formatCompactDate, getAdminOverviewData } from "@/lib/admin-data";
import { formatInr } from "@/lib/utils";

export default async function AdminOverviewPage() {
  const data = await getAdminOverviewData();
  const kpis = [
    { label: "Published Courses", value: String(data.publishedCourses.length), trend: "Live courses" },
    { label: "Draft Courses", value: String(data.courses.length - data.publishedCourses.length), trend: "Need review" },
    { label: "Lessons", value: String(data.videos.length), trend: "Across all courses" },
    { label: "Resources", value: String(data.resources.length), trend: "Course materials" },
    { label: "Active Learners", value: String(data.activeMembers.length), trend: "Enrolled members" },
    { label: "Course Completion", value: `${data.completionRate}%`, trend: "Average progress" },
  ];

  return (
    <>
      <section className="admin-kpi-grid">
        {kpis.map((kpi) => (
          <article key={kpi.label} className="card admin-kpi-card">
            <strong>{kpi.value}</strong>
            <p>{kpi.label}</p>
            <small>{kpi.trend}</small>
          </article>
        ))}
      </section>

      <div className="admin-page-grid">
        <section className="card admin-operating-section">
          <div className="admin-section-heading">
            <div>
              <p>Next Actions</p>
              <h2>Admin Workflow</h2>
            </div>
          </div>
          <div className="admin-action-list">
            <Link className="admin-action-item" href="/admin/courses">
              <strong>Create or edit courses</strong>
              <span>Course basics, pricing, thumbnails, publish state.</span>
            </Link>
            <Link className="admin-action-item" href="/admin/lessons">
              <strong>Manage curriculum</strong>
              <span>Add lessons, replace videos, attach resources.</span>
            </Link>
            <Link className="admin-action-item" href="/admin/students">
              <strong>Review enrolled members</strong>
              <span>CRM, course access, payments, and progress.</span>
            </Link>
            <Link className="admin-action-item" href="/admin/payments">
              <strong>Handle payments</strong>
              <span>Inspect Razorpay/manual payment status and references.</span>
            </Link>
          </div>
        </section>

        <section className="card admin-operating-section">
          <div className="admin-section-heading">
            <div>
              <p>Payments</p>
              <h2>Recent Operations</h2>
            </div>
            <Link className="btn btn-secondary" href="/admin/payments">
              View All
            </Link>
          </div>
          <div className="admin-payment-grid admin-payment-grid-single">
            {data.recentPayments.length === 0 ? (
              <p className="muted">No payment requests yet.</p>
            ) : (
              data.recentPayments.map((payment) => (
                <article key={payment.id} className="admin-payment-row">
                  <strong>{payment.user.name ?? payment.user.email ?? "Student"}</strong>
                  <span>{payment.course.title}</span>
                  <small>{formatInr(payment.amountInr)} - {payment.status}</small>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="card admin-operating-section">
        <div className="admin-section-heading">
          <div>
            <p>Health</p>
            <h2>Course Health Snapshot</h2>
          </div>
          <Link className="btn btn-secondary" href="/admin/community">
            Community
          </Link>
        </div>
        <div className="admin-health-grid">
          <p>Pending doubts <strong>{data.pendingDoubts}</strong></p>
          <p>Last lesson <strong>{data.lastLesson ? `L${data.lastLesson.order} - ${data.lastLesson.title}` : "No lessons yet"}</strong></p>
          <p>Latest community item <strong>{data.recentDoubts[0] ? formatCompactDate(data.recentDoubts[0].createdAt) : "No activity"}</strong></p>
        </div>
      </section>
    </>
  );
}
