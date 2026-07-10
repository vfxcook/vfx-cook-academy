import Link from "next/link";

import { formatCompactDate, getAdminStudents } from "@/lib/admin-data";
import { adminCrmColumns } from "@/lib/admin-workspace";
import { formatInr } from "@/lib/utils";

export default async function AdminStudentsPage() {
  const students = await getAdminStudents();

  return (
    <section className="card admin-operating-section">
      <div className="admin-section-heading">
        <div>
          <p>Students CRM</p>
          <h2>Members, Access, Payments, and Progress</h2>
        </div>
        <span className="admin-count-pill">{students.length} contacts</span>
      </div>

      <div className="admin-crm-table" role="table" aria-label="Students CRM">
        <div className="admin-crm-head" role="row">
          {adminCrmColumns.map((column) => (
            <span key={column} role="columnheader">
              {column}
            </span>
          ))}
        </div>
        {students.length === 0 ? (
          <p className="muted">No students have registered yet.</p>
        ) : (
          students.map((student) => {
            const activeCourses = student.courses.filter((course) => course.isActive);
            const averageProgress =
              student.courses.length > 0
                ? Math.round(student.courses.reduce((sum, course) => sum + course.progressPercent, 0) / student.courses.length)
                : 0;

            return (
              <article key={student.id} className="admin-crm-row" role="row">
                <div>
                  <strong>{student.name}</strong>
                  <small>Joined {formatCompactDate(student.joinedAt)}</small>
                </div>
                <div>
                  <span>{student.email}</span>
                  <small>{student.phone}</small>
                </div>
                <div>
                  <strong>{student.courses.length || "No"} course{student.courses.length === 1 ? "" : "s"}</strong>
                  <small>{activeCourses.length} active</small>
                </div>
                <div>
                  <span className={student.latestPayment?.status === "APPROVED" ? "admin-badge-published" : "admin-badge-draft"}>
                    {student.latestPayment?.status ?? "NO PAYMENT"}
                  </span>
                  <small>{student.latestPayment ? formatInr(student.latestPayment.amountInr) : "No transaction"}</small>
                </div>
                <div>
                  <div className="admin-progress-bar" aria-label={`Progress ${averageProgress}%`}>
                    <span style={{ width: `${averageProgress}%` }} />
                  </div>
                  <small>{averageProgress}% average</small>
                </div>
                <div>
                  <span>{formatCompactDate(student.lastActivity)}</span>
                  <small>{student.courses[0]?.title ?? "No course yet"}</small>
                </div>
                <div className="admin-crm-actions">
                  <a className="btn btn-secondary" href={`mailto:${student.email}`}>
                    Email
                  </a>
                  {student.courses[0] ? (
                    <Link className="btn btn-secondary" href={`/course/${student.courses[0].slug}`}>
                      Course
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
