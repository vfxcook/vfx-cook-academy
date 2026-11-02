import { useMemo, useState } from 'react';
import { useLoaderData, useRevalidator } from 'react-router';
import { Avatar, Dialog, EmptyState, Meter, Notice } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { formatDate, formatInr, formatRelative } from '../../lib/format';
import type { AdminStudent } from '../../lib/types';

export async function adminStudentsLoader() {
  const [students, courses] = await Promise.all([api.admin.students(), api.admin.courses()]);
  return {
    students: students.students,
    courses: courses.courses.map(course => ({ id: course.id, title: course.title }))
  };
}

export default function AdminStudents() {
  const { students, courses } = useLoaderData<typeof adminStudentsLoader>();
  const revalidator = useRevalidator();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<AdminStudent | null>(null);
  const [grantCourseId, setGrantCourseId] = useState(courses[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return students;
    return students.filter(
      student =>
        student.name.toLowerCase().includes(needle) ||
        student.email.toLowerCase().includes(needle) ||
        (student.phone ?? '').includes(needle)
    );
  }, [students, query]);

  const act = async (studentId: string, courseId: string, action: 'grant' | 'revoke') => {
    setBusy(true);
    setError('');
    try {
      if (action === 'grant') await api.admin.grantCourse(studentId, courseId);
      else await api.admin.revokeCourse(studentId, courseId);
      setSelected(null);
      revalidator.revalidate();
    } catch (thrown) {
      setError(errorMessage(thrown, 'That did not go through.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head" style={{ paddingTop: 0 }}>
        <div className="ac-between" style={{ flexWrap: 'wrap' }}>
          <div>
            <p className="ac-eyebrow">Admin</p>
            <h1>Students</h1>
          </div>
          <div style={{ minWidth: 220, flex: '0 1 280px' }}>
            <label className="ac-sr-only" htmlFor="student-search">
              Search students
            </label>
            <input
              id="student-search"
              className="ac-input"
              type="search"
              placeholder="Name, email or phone…"
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
          </div>
        </div>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <section className="ac-panel adm-card">
        {visible.length === 0 ? (
          <EmptyState title="No students match that">Try a different name or email.</EmptyState>
        ) : (
          <div className="ac-table-wrap">
            <table className="ac-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Contact</th>
                  <th>Courses</th>
                  <th>Credits</th>
                  <th>Joined</th>
                  <th>Last active</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map(student => (
                  <tr key={student.id}>
                    <td>
                      <div className="ac-row" style={{ gap: 9, flexWrap: 'nowrap' }}>
                        <Avatar name={student.name} size="sm" />
                        <span>
                          {student.name}
                          {student.role === 'ADMIN' ? (
                            <span className="ac-chip ac-chip--accent" style={{ marginLeft: 7 }}>
                              admin
                            </span>
                          ) : null}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="adm-mini">{student.email}</div>
                      {student.phone ? <div className="adm-mini">{student.phone}</div> : null}
                    </td>
                    <td>
                      {student.courses.length === 0 ? (
                        <span className="adm-mini">none</span>
                      ) : (
                        <div className="adm-pill-row">
                          {student.courses.map(course => (
                            <span
                              key={course.id}
                              className={`ac-chip ${
                                course.isActive
                                  ? 'ac-chip--ok'
                                  : course.awaitingLicense
                                    ? 'ac-chip--ember'
                                    : 'ac-chip--warn'
                              }`}
                            >
                              {course.title} · {course.percent}%
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="ac-mono">{student.studioCredits}</td>
                    <td>{formatDate(student.joinedAt)}</td>
                    <td>{formatRelative(student.lastActivity)}</td>
                    <td>
                      <button
                        type="button"
                        className="ac-btn ac-btn--quiet ac-btn--sm"
                        onClick={() => setSelected(student)}
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected ? (
        <Dialog title={selected.name} onClose={() => setSelected(null)} wide>
          <div className="ac-stack">
            <div className="ac-row" style={{ gap: 14 }}>
              <Avatar name={selected.name} size="lg" />
              <div>
                <strong style={{ fontSize: 15 }}>{selected.email}</strong>
                <p className="adm-mini" style={{ margin: '4px 0 0' }}>
                  Joined {formatDate(selected.joinedAt)} · {selected.studioCredits} studio credits
                </p>
              </div>
            </div>

            {selected.latestPayment ? (
              <Notice>
                Last payment: {formatInr(selected.latestPayment.amountInr)} for{' '}
                {selected.latestPayment.course.title} —{' '}
                {selected.latestPayment.status.toLowerCase()}.
              </Notice>
            ) : null}

            <div>
              <p className="ac-label" style={{ marginBottom: 10 }}>
                Enrolments
              </p>
              {selected.courses.length === 0 ? (
                <p className="ac-hint">Not enrolled in anything yet.</p>
              ) : (
                <div className="ac-stack" style={{ gap: 12 }}>
                  {selected.courses.map(course => (
                    <div key={course.id} className="ac-between" style={{ gap: 14 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ fontSize: 13.5 }}>{course.title}</strong>
                        <div style={{ marginTop: 6 }}>
                          <Meter percent={course.percent} label={`${course.title} progress`} />
                        </div>
                      </div>
                      <span className={`ac-chip ${course.isActive ? 'ac-chip--ok' : 'ac-chip--warn'}`}>
                        {course.isActive ? 'active' : course.awaitingLicense ? 'license sent' : 'locked'}
                      </span>
                      <button
                        type="button"
                        className="ac-btn ac-btn--quiet ac-btn--sm"
                        disabled={busy}
                        onClick={() =>
                          act(selected.id, course.id, course.isActive ? 'revoke' : 'grant')
                        }
                      >
                        {course.isActive ? 'Revoke' : 'Grant'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="ac-label" style={{ marginBottom: 10 }}>
                Grant access to another course
              </p>
              <div className="ac-row">
                <div className="ac-select-wrap" style={{ flex: 1, minWidth: 180 }}>
                  <select
                    className="ac-select"
                    value={grantCourseId}
                    onChange={event => setGrantCourseId(event.target.value)}
                    aria-label="Course to grant"
                  >
                    {courses.map(course => (
                      <option key={course.id} value={course.id}>
                        {course.title}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="ac-btn ac-btn--primary"
                  disabled={busy || !grantCourseId}
                  onClick={() => act(selected.id, grantCourseId, 'grant')}
                >
                  {busy ? 'Working…' : 'Grant access'}
                </button>
              </div>
              <p className="ac-hint" style={{ marginTop: 8 }}>
                Granting skips the license code and unlocks the course straight away.
              </p>
            </div>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
