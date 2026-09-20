import { Link, useLoaderData } from 'react-router';
import { EmptyState } from '../../components/ui';
import { api } from '../../lib/api';
import { formatInr, formatRelative, formatTimecode } from '../../lib/format';

export async function adminOverviewLoader() {
  return api.admin.overview();
}

export default function AdminOverview() {
  const { stats, courses, recentPayments, recentDoubts } = useLoaderData<typeof adminOverviewLoader>();

  const tiles: Array<{ label: string; value: string; tone?: string }> = [
    { label: 'Active students', value: String(stats.activeStudents), tone: 'ember' },
    { label: 'Revenue', value: formatInr(stats.revenueInr), tone: 'ok' },
    { label: 'Pending payments', value: String(stats.pendingPayments), tone: stats.pendingPayments > 0 ? 'warn' : undefined },
    { label: 'Courses live', value: `${stats.publishedCourses}/${stats.courses}` },
    { label: 'Lessons', value: String(stats.lessons) },
    { label: 'Completion', value: `${stats.completionRate}%` },
    { label: 'Resources', value: String(stats.resources) },
    { label: 'Studio credits out', value: stats.studioCreditsOutstanding.toLocaleString('en-IN') }
  ];

  return (
    <>
      <div className="page-head" style={{ paddingTop: 0 }}>
        <p className="ac-eyebrow">Admin</p>
        <h1>Overview</h1>
      </div>

      <div className="adm-stats">
        {tiles.map(tile => (
          <div key={tile.label} className="ac-panel adm-stat" data-tone={tile.tone}>
            <b>{tile.value}</b>
            <span>{tile.label}</span>
          </div>
        ))}
      </div>

      <section className="ac-panel adm-card">
        <div className="adm-card-head">
          <h2>Courses</h2>
          <Link className="ac-btn ac-btn--ghost ac-btn--sm" to="/admin/courses">
            Manage
          </Link>
        </div>

        {courses.length === 0 ? (
          <EmptyState title="No courses yet">Create the first course to start enrolling.</EmptyState>
        ) : (
          <div className="ac-table-wrap">
            <table className="ac-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Price</th>
                  <th>Lessons</th>
                  <th>Students</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {courses.map(course => (
                  <tr key={course.id}>
                    <td>{course.title}</td>
                    <td>{formatInr(course.priceInr)}</td>
                    <td>{course.lessonCount}</td>
                    <td>{course.studentCount}</td>
                    <td>
                      <span className={`ac-chip ${course.isPublished ? 'ac-chip--ok' : 'ac-chip--warn'}`}>
                        {course.isPublished ? 'Live' : 'Draft'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="ac-panel adm-card">
        <div className="adm-card-head">
          <h2>Latest payments</h2>
          <Link className="ac-btn ac-btn--ghost ac-btn--sm" to="/admin/payments">
            Review queue
          </Link>
        </div>

        {recentPayments.length === 0 ? (
          <EmptyState title="No payments yet">Enrolments will show up here as they come in.</EmptyState>
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
                </tr>
              </thead>
              <tbody>
                {recentPayments.map(payment => (
                  <tr key={payment.id}>
                    <td>
                      {payment.user.name ?? '—'}
                      <div className="adm-mini">{payment.user.email}</div>
                    </td>
                    <td>{payment.course.title}</td>
                    <td>{formatInr(payment.amountInr)}</td>
                    <td className="ac-mono">{payment.transactionRef}</td>
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
                    </td>
                    <td>{formatRelative(payment.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="ac-panel adm-card">
        <div className="adm-card-head">
          <h2>Latest doubts</h2>
          <Link className="ac-btn ac-btn--ghost ac-btn--sm" to="/admin/lessons">
            Lessons
          </Link>
        </div>

        {recentDoubts.length === 0 ? (
          <EmptyState title="No questions yet">
            Timestamped doubts from the classroom land here.
          </EmptyState>
        ) : (
          <div className="ac-table-wrap">
            <table className="ac-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Lesson</th>
                  <th>At</th>
                  <th>Question</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {recentDoubts.map(doubt => (
                  <tr key={doubt.id}>
                    <td>{doubt.user.name ?? doubt.user.email}</td>
                    <td>
                      {doubt.video.title}
                      <div className="adm-mini">{doubt.video.course.title}</div>
                    </td>
                    <td className="ac-mono">{formatTimecode(doubt.timestamp)}</td>
                    <td style={{ maxWidth: 340 }}>{doubt.text}</td>
                    <td>{formatRelative(doubt.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
