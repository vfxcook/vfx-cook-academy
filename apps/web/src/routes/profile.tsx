import { useState, type FormEvent } from 'react';
import { redirect, useLoaderData } from 'react-router';
import { Avatar, Field, Notice } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { formatDate } from '../lib/format';

export async function profileLoader() {
  const session = await api.auth.session();
  if (!session.user) return redirect('/sign-in?next=%2Fprofile');

  const dashboard = await api.courses.dashboard();
  return { user: session.user, courses: dashboard.courses };
}

export default function Profile() {
  const { user, courses } = useLoaderData<typeof profileLoader>();

  const [form, setForm] = useState({
    name: user.name ?? '',
    phone: user.phone ?? '',
    image: user.image ?? ''
  });
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');

  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setProfileBusy(true);
    setProfileError('');
    setProfileMessage('');
    try {
      await api.auth.updateProfile({
        name: form.name,
        phone: form.phone || undefined,
        image: form.image || undefined
      });
      setProfileMessage('Saved.');
    } catch (thrown) {
      setProfileError(errorMessage(thrown, 'Could not save that.'));
    } finally {
      setProfileBusy(false);
    }
  };

  const savePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (passwords.next !== passwords.confirm) {
      setPasswordError('Those two passwords do not match.');
      return;
    }

    setPasswordBusy(true);
    setPasswordError('');
    setPasswordMessage('');
    try {
      await api.auth.changePassword({
        currentPassword: passwords.current || undefined,
        newPassword: passwords.next
      });
      setPasswordMessage('Password updated.');
      setPasswords({ current: '', next: '', confirm: '' });
    } catch (thrown) {
      setPasswordError(errorMessage(thrown, 'Could not change your password.'));
    } finally {
      setPasswordBusy(false);
    }
  };

  const activeCourses = courses.filter(course => course.isActive);
  const lessonsDone = activeCourses.reduce((sum, course) => sum + course.completedLessons, 0);

  return (
    <div className="ac-shell" style={{ paddingBottom: 'clamp(48px, 7vw, 88px)', maxWidth: 820 }}>
      <div className="page-head">
        <p className="ac-eyebrow">Account</p>
        <h1>Profile &amp; settings</h1>
      </div>

      <div className="ac-panel" style={{ padding: 'clamp(20px, 2.6vw, 30px)', marginBottom: 20 }}>
        <div className="ac-row" style={{ gap: 16 }}>
          <Avatar name={form.name || user.email} src={form.image || user.image} size="lg" />
          <div>
            <strong style={{ fontSize: 16 }}>{form.name || 'Your name'}</strong>
            <p className="ac-hint" style={{ margin: '4px 0 0' }}>
              {user.email} · {user.role === 'ADMIN' ? 'Admin' : 'Student'}
            </p>
          </div>
          <span className="ac-spacer" />
          <div className="ac-row" style={{ gap: 6 }}>
            <span className="ac-chip">{activeCourses.length} courses</span>
            <span className="ac-chip ac-chip--ember">{lessonsDone} lessons done</span>
          </div>
        </div>
      </div>

      <form
        className="ac-panel ac-stack"
        style={{ padding: 'clamp(20px, 2.6vw, 30px)', marginBottom: 20 }}
        onSubmit={saveProfile}
      >
        <div>
          <p className="ac-eyebrow">Details</p>
          <h2 className="ac-title" style={{ fontSize: 20, marginTop: 6 }}>
            How you appear to the batch
          </h2>
        </div>

        {profileMessage ? <Notice tone="ok">{profileMessage}</Notice> : null}
        {profileError ? <Notice tone="error">{profileError}</Notice> : null}

        <Field label="Name" htmlFor="profile-name">
          <input
            id="profile-name"
            className="ac-input"
            required
            minLength={2}
            value={form.name}
            onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
          />
        </Field>

        <Field label="Phone" htmlFor="profile-phone" hint="Used only for payment follow-ups.">
          <input
            id="profile-phone"
            className="ac-input"
            type="tel"
            value={form.phone}
            onChange={event => setForm(current => ({ ...current, phone: event.target.value }))}
          />
        </Field>

        <Field
          label="Avatar URL"
          htmlFor="profile-image"
          hint="Paste a link to an image. Leave it empty to use your initials."
        >
          <input
            id="profile-image"
            className="ac-input"
            type="url"
            value={form.image}
            onChange={event => setForm(current => ({ ...current, image: event.target.value }))}
            placeholder="https://…"
          />
        </Field>

        <div className="ac-row" style={{ justifyContent: 'flex-end' }}>
          <button type="submit" className="ac-btn ac-btn--primary" disabled={profileBusy}>
            {profileBusy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>

      <form
        className="ac-panel ac-stack"
        style={{ padding: 'clamp(20px, 2.6vw, 30px)' }}
        onSubmit={savePassword}
      >
        <div>
          <p className="ac-eyebrow">Security</p>
          <h2 className="ac-title" style={{ fontSize: 20, marginTop: 6 }}>
            Password
          </h2>
        </div>

        {passwordMessage ? <Notice tone="ok">{passwordMessage}</Notice> : null}
        {passwordError ? <Notice tone="error">{passwordError}</Notice> : null}

        <Field
          label="Current password"
          htmlFor="current-password"
          hint="Leave empty if you signed up with Google and have never set one."
        >
          <input
            id="current-password"
            className="ac-input"
            type="password"
            autoComplete="current-password"
            value={passwords.current}
            onChange={event => setPasswords(current => ({ ...current, current: event.target.value }))}
          />
        </Field>

        <Field label="New password" htmlFor="new-password" hint="At least 8 characters.">
          <input
            id="new-password"
            className="ac-input"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={passwords.next}
            onChange={event => setPasswords(current => ({ ...current, next: event.target.value }))}
          />
        </Field>

        <Field label="Confirm new password" htmlFor="confirm-password">
          <input
            id="confirm-password"
            className="ac-input"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={passwords.confirm}
            onChange={event => setPasswords(current => ({ ...current, confirm: event.target.value }))}
          />
        </Field>

        <div className="ac-row" style={{ justifyContent: 'flex-end' }}>
          <button type="submit" className="ac-btn ac-btn--ghost" disabled={passwordBusy}>
            {passwordBusy ? 'Updating…' : 'Update password'}
          </button>
        </div>
      </form>

      {activeCourses.length > 0 ? (
        <section style={{ marginTop: 28 }}>
          <div className="page-head">
            <p className="ac-eyebrow">Enrolments</p>
            <h2 className="ac-title">Your courses</h2>
          </div>
          <div className="ac-table-wrap">
            <table className="ac-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Progress</th>
                  <th>Activated</th>
                </tr>
              </thead>
              <tbody>
                {activeCourses.map(course => (
                  <tr key={course.id}>
                    <td>{course.title}</td>
                    <td>
                      {course.completedLessons}/{course.lessonCount} · {course.percent}%
                    </td>
                    <td>{formatDate(course.activatedAt)}</td>
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
