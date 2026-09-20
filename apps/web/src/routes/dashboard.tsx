import { useState, type FormEvent } from 'react';
import { Link, redirect, useLoaderData, useRevalidator } from 'react-router';
import { EnrolledCourseCard } from '../components/CourseCard';
import { EmptyState, Field, Notice } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { formatDate, formatInr } from '../lib/format';
import '../styles/course.css';

export async function dashboardLoader() {
  const session = await api.auth.session();
  if (!session.user) return redirect('/sign-in?next=%2Fdashboard');
  return api.courses.dashboard();
}

function ActivateLicense({
  courses
}: {
  courses: Array<{ id: string; title: string; awaitingLicense: boolean }>;
}) {
  const awaiting = courses.filter(course => course.awaitingLicense);
  const revalidator = useRevalidator();

  const [courseId, setCourseId] = useState(awaiting[0]?.id ?? '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (awaiting.length === 0) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.courses.activateLicense({ courseId, licenseCode: code.trim().toUpperCase() });
      setDone(true);
      setCode('');
      revalidator.revalidate();
    } catch (thrown) {
      setError(errorMessage(thrown, 'That code did not work.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ac-panel" id="activate" style={{ padding: 'clamp(20px, 2.4vw, 28px)' }}>
      <p className="ac-eyebrow">Unlock a course</p>
      <h2 className="ac-title" style={{ fontSize: 21, margin: '6px 0 14px' }}>
        Enter your license code
      </h2>

      {done ? <Notice tone="ok">Unlocked. Your lessons are ready below.</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      <form
        className="ac-row"
        style={{ gap: 12, alignItems: 'flex-end', marginTop: 12 }}
        onSubmit={submit}
      >
        <div style={{ flex: '1 1 220px', minWidth: 200 }}>
          <Field label="Course" htmlFor="license-course">
            <div className="ac-select-wrap">
              <select
                id="license-course"
                className="ac-select"
                value={courseId}
                onChange={event => setCourseId(event.target.value)}
              >
                {awaiting.map(course => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </div>
          </Field>
        </div>

        <div style={{ flex: '1 1 180px', minWidth: 160 }}>
          <Field label="License code" htmlFor="license-code">
            <input
              id="license-code"
              className="ac-input ac-mono"
              style={{ textTransform: 'uppercase', letterSpacing: '0.12em' }}
              required
              minLength={4}
              maxLength={20}
              value={code}
              onChange={event => setCode(event.target.value)}
              placeholder="XXXXXXXX"
            />
          </Field>
        </div>

        <button type="submit" className="ac-btn ac-btn--primary" disabled={busy}>
          {busy ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </section>
  );
}

export default function Dashboard() {
  const { courses, gifts } = useLoaderData<typeof dashboardLoader>();

  const active = courses.filter(course => course.isActive);
  const pending = courses.filter(course => !course.isActive);
  const finished = active.filter(course => course.percent >= 100).length;

  return (
    <div className="ac-shell" style={{ paddingBottom: 'clamp(48px, 7vw, 88px)' }}>
      <div className="page-head">
        <p className="ac-eyebrow">Your classroom</p>
        <h1>Continue the reel</h1>
        {active.length > 0 ? (
          <p className="ac-lede">
            {active.length} course{active.length === 1 ? '' : 's'} in progress
            {finished > 0 ? ` · ${finished} finished` : ''}.
          </p>
        ) : null}
      </div>

      {pending.length > 0 ? (
        <div style={{ marginBottom: 28 }}>
          <ActivateLicense courses={pending} />
        </div>
      ) : null}

      {courses.length === 0 ? (
        <EmptyState
          title="No courses yet"
          action={
            <Link className="ac-btn ac-btn--primary" to="/courses">
              Browse courses
            </Link>
          }
        >
          Pick a batch and your lessons, doubts and progress all live here.
        </EmptyState>
      ) : (
        <div className="ac-grid">
          {[...active, ...pending].map(course => (
            <EnrolledCourseCard key={course.id} course={course} />
          ))}
        </div>
      )}

      {gifts.length > 0 ? (
        <section style={{ marginTop: 'clamp(36px, 5vw, 64px)' }}>
          <div className="page-head">
            <p className="ac-eyebrow">Gifts you bought</p>
            <h2 className="ac-title">Share the code</h2>
          </div>

          <div className="ac-table-wrap">
            <table className="ac-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Code</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Bought</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {gifts.map(gift => (
                  <tr key={gift.id}>
                    <td>{gift.course.title}</td>
                    <td className="ac-mono">{gift.code}</td>
                    <td>{formatInr(gift.amountInr)}</td>
                    <td>
                      <span className={`ac-chip ${gift.isRedeemed ? 'ac-chip--ok' : 'ac-chip--ember'}`}>
                        {gift.isRedeemed ? 'Redeemed' : 'Unused'}
                      </span>
                    </td>
                    <td>{formatDate(gift.createdAt)}</td>
                    <td>
                      <Link className="ac-btn ac-btn--quiet ac-btn--sm" to={`/gift/${gift.id}`}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
