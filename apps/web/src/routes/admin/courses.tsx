import { useState, type FormEvent } from 'react';
import { useLoaderData, useRevalidator } from 'react-router';
import { Dialog, EmptyState, Field, Notice } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { formatInr, toDateInputValue } from '../../lib/format';
import type { AdminCourseFull } from '../../lib/types';

export async function adminCoursesLoader() {
  return api.admin.courses();
}

function CourseForm({
  course,
  onClose,
  onSaved
}: {
  course: AdminCourseFull | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');

    const body = new FormData(event.currentTarget);
    // Unchecked checkboxes are absent from FormData, so send them explicitly.
    for (const key of ['isPublished', 'freePreviewFirstLesson']) {
      body.set(key, body.get(key) ? 'true' : 'false');
    }

    try {
      if (course) await api.admin.updateCourse(course.id, body);
      else await api.admin.createCourse(body);
      onSaved();
      onClose();
    } catch (thrown) {
      setError(errorMessage(thrown, 'Could not save that course.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={course ? `Edit ${course.title}` : 'New course'} onClose={onClose} wide>
      <form id="course-form" onSubmit={submit} className="ac-stack">
        {error ? <Notice tone="error">{error}</Notice> : null}

        <div className="adm-form-grid">
          <div className="adm-span">
            <Field label="Title" htmlFor="c-title">
              <input id="c-title" name="title" className="ac-input" required defaultValue={course?.title} />
            </Field>
          </div>

          <Field label="Slug" htmlFor="c-slug" hint="Lowercase, dash separated.">
            <input id="c-slug" name="slug" className="ac-input ac-mono" required defaultValue={course?.slug} />
          </Field>

          <Field label="Price (INR)" htmlFor="c-price">
            <input
              id="c-price"
              name="priceInr"
              className="ac-input"
              type="number"
              min={1}
              required
              defaultValue={course?.priceInr ?? 499}
            />
          </Field>

          <Field label="Batch opens" htmlFor="c-from" hint="Optional.">
            <input
              id="c-from"
              name="availableFrom"
              className="ac-input"
              type="date"
              defaultValue={toDateInputValue(course?.availableFrom)}
            />
          </Field>

          <div className="adm-span">
            <Field label="Description" htmlFor="c-desc">
              <textarea
                id="c-desc"
                name="description"
                className="ac-textarea"
                required
                defaultValue={course?.description}
              />
            </Field>
          </div>

          <div className="adm-span adm-file">
            <span className="ac-label">Thumbnail</span>
            <input name="thumbnailFile" type="file" accept="image/*" />
            <input type="hidden" name="existingThumbnail" defaultValue={course?.thumbnailUrl ?? ''} />
            <span className="ac-hint">
              {course?.thumbnailUrl ? 'Leave empty to keep the current image.' : 'Images up to 5MB.'}
            </span>
          </div>

          <label className="ac-checkbox">
            <input type="checkbox" name="isPublished" defaultChecked={course?.isPublished} />
            Published
          </label>

          <label className="ac-checkbox">
            <input
              type="checkbox"
              name="freePreviewFirstLesson"
              defaultChecked={course?.freePreviewFirstLesson}
            />
            First lesson free
          </label>
        </div>

        <div className="ac-row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="ac-btn ac-btn--quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="ac-btn ac-btn--primary" disabled={busy}>
            {busy ? 'Saving…' : course ? 'Save changes' : 'Create course'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export default function AdminCourses() {
  const { courses } = useLoaderData<typeof adminCoursesLoader>();
  const revalidator = useRevalidator();

  const [editing, setEditing] = useState<AdminCourseFull | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState<AdminCourseFull | null>(null);
  const [error, setError] = useState('');

  const refresh = () => revalidator.revalidate();

  return (
    <>
      <div className="page-head" style={{ paddingTop: 0 }}>
        <div className="ac-between" style={{ flexWrap: 'wrap' }}>
          <div>
            <p className="ac-eyebrow">Admin</p>
            <h1>Courses</h1>
          </div>
          <button type="button" className="ac-btn ac-btn--primary" onClick={() => setCreating(true)}>
            New course
          </button>
        </div>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <section className="ac-panel adm-card">
        {courses.length === 0 ? (
          <EmptyState title="No courses yet">Create the first course to start enrolling.</EmptyState>
        ) : (
          courses.map(course => (
            <article key={course.id} className="adm-course">
              <div className="adm-course-poster">
                {course.thumbnailUrl ? (
                  <img src={course.thumbnailUrl} alt="" />
                ) : (
                  <span>{course.title.slice(0, 2)}</span>
                )}
              </div>

              <div className="adm-course-body">
                <strong>{course.title}</strong>
                <span className="adm-mini">/{course.slug}</span>
                <div className="adm-pill-row">
                  <span className={`ac-chip ${course.isPublished ? 'ac-chip--ok' : 'ac-chip--warn'}`}>
                    {course.isPublished ? 'Live' : 'Draft'}
                  </span>
                  <span className="ac-chip">{formatInr(course.priceInr)}</span>
                  <span className="ac-chip">{course.videos.length} lessons</span>
                  <span className="ac-chip">{course._count.enrollments} students</span>
                  {course.freePreviewFirstLesson ? (
                    <span className="ac-chip ac-chip--ember">Free preview</span>
                  ) : null}
                </div>
              </div>

              <div className="adm-course-actions">
                <button
                  type="button"
                  className="ac-btn ac-btn--ghost ac-btn--sm"
                  onClick={() => setEditing(course)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="ac-btn ac-btn--quiet ac-btn--sm"
                  onClick={async () => {
                    try {
                      await api.admin.publishCourse(course.id, !course.isPublished);
                      refresh();
                    } catch (thrown) {
                      setError(errorMessage(thrown, 'Could not change that.'));
                    }
                  }}
                >
                  {course.isPublished ? 'Unpublish' : 'Publish'}
                </button>
                <button
                  type="button"
                  className="ac-btn ac-btn--danger ac-btn--sm"
                  onClick={() => setConfirming(course)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      {creating ? (
        <CourseForm course={null} onClose={() => setCreating(false)} onSaved={refresh} />
      ) : null}

      {editing ? (
        <CourseForm course={editing} onClose={() => setEditing(null)} onSaved={refresh} />
      ) : null}

      {confirming ? (
        <Dialog title="Delete this course?" onClose={() => setConfirming(null)}>
          <p className="ac-lede">
            <strong>{confirming.title}</strong> has {confirming.videos.length} lessons and{' '}
            {confirming._count.enrollments} enrolled students. Deleting it removes the lessons,
            resources, progress and community posts attached to it. This cannot be undone.
          </p>
          <div className="ac-row" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" className="ac-btn ac-btn--quiet" onClick={() => setConfirming(null)}>
              Keep it
            </button>
            <button
              type="button"
              className="ac-btn ac-btn--danger"
              onClick={async () => {
                try {
                  await api.admin.deleteCourse(confirming.id);
                  setConfirming(null);
                  refresh();
                } catch (thrown) {
                  setError(errorMessage(thrown, 'Could not delete that course.'));
                  setConfirming(null);
                }
              }}
            >
              Delete permanently
            </button>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
