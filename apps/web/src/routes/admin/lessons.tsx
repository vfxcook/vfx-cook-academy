import { useMemo, useState, type FormEvent } from 'react';
import { useLoaderData, useRevalidator } from 'react-router';
import { Dialog, EmptyState, Field, Notice } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { formatTimecode, slateNumber } from '../../lib/format';
import type { AdminLessonRow } from '../../lib/types';

export async function adminLessonsLoader() {
  return api.admin.lessons();
}

type CourseOption = { id: string; slug: string; title: string; lessons: AdminLessonRow[] };

function LessonForm({
  courseId,
  lesson,
  nextOrder,
  onClose,
  onSaved
}: {
  courseId: string;
  lesson: AdminLessonRow | null;
  nextOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [source, setSource] = useState<'url' | 'upload'>('url');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');

    const body = new FormData(event.currentTarget);
    body.set('courseId', courseId);
    if (source === 'url') body.delete('videoFile');

    try {
      if (lesson) await api.admin.updateLesson(lesson.id, body);
      else await api.admin.createLesson(body);
      onSaved();
      onClose();
    } catch (thrown) {
      setError(errorMessage(thrown, 'Could not save that lesson.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={lesson ? `Edit ${lesson.title}` : 'New lesson'} onClose={onClose} wide>
      <form onSubmit={submit} className="ac-stack">
        {error ? <Notice tone="error">{error}</Notice> : null}

        <div className="adm-form-grid">
          <div className="adm-span">
            <Field label="Title" htmlFor="l-title">
              <input id="l-title" name="title" className="ac-input" required defaultValue={lesson?.title} />
            </Field>
          </div>

          <Field label="Order" htmlFor="l-order" hint="Lessons unlock in this order.">
            <input
              id="l-order"
              name="order"
              className="ac-input"
              type="number"
              min={1}
              required
              defaultValue={lesson?.order ?? nextOrder}
            />
          </Field>

          <Field label="Duration (seconds)" htmlFor="l-duration">
            <input
              id="l-duration"
              name="durationSec"
              className="ac-input"
              type="number"
              min={0}
              defaultValue={lesson?.durationSec ?? 0}
            />
          </Field>

          <div className="adm-span">
            <Field
              label="Notes"
              htmlFor="l-desc"
              hint="Markdown. Rendered under the player and sanitised before it is stored."
            >
              <textarea
                id="l-desc"
                name="description"
                className="ac-textarea"
                style={{ minHeight: 140 }}
                defaultValue={lesson?.description ?? ''}
              />
            </Field>
          </div>

          <div className="adm-span">
            <div className="ac-row" style={{ marginBottom: 10 }}>
              <button
                type="button"
                className={`ac-btn ac-btn--sm ${source === 'url' ? 'ac-btn--ghost' : 'ac-btn--quiet'}`}
                onClick={() => setSource('url')}
              >
                Hosted URL
              </button>
              <button
                type="button"
                className={`ac-btn ac-btn--sm ${source === 'upload' ? 'ac-btn--ghost' : 'ac-btn--quiet'}`}
                onClick={() => setSource('upload')}
              >
                Upload a file
              </button>
            </div>

            {source === 'url' ? (
              <Field
                label="Video URL"
                htmlFor="l-url"
                hint="YouTube, Vimeo or a direct file link. Uploaded files get real progress tracking; hosted players do not."
              >
                <input
                  id="l-url"
                  name="videoUrl"
                  className="ac-input"
                  defaultValue={lesson?.videoUrl}
                  placeholder="https://youtu.be/…"
                />
              </Field>
            ) : (
              <div className="adm-file">
                <span className="ac-label">Video file</span>
                <input name="videoFile" type="file" accept="video/*" />
                <span className="ac-hint">
                  Uploaded lessons scrub to comment timestamps and track progress automatically.
                </span>
              </div>
            )}

            <input type="hidden" name="existingVideoUrl" defaultValue={lesson?.videoUrl ?? ''} />
          </div>
        </div>

        <div className="ac-row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="ac-btn ac-btn--quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="ac-btn ac-btn--primary" disabled={busy}>
            {busy ? 'Saving…' : lesson ? 'Save lesson' : 'Add lesson'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function ResourceForm({
  course,
  onClose,
  onSaved
}: {
  course: CourseOption;
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
    body.set('courseId', course.id);

    try {
      await api.admin.createResource(body);
      onSaved();
      onClose();
    } catch (thrown) {
      setError(errorMessage(thrown, 'Could not add that resource.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={`Add a resource to ${course.title}`} onClose={onClose}>
      <form onSubmit={submit} className="ac-stack">
        {error ? <Notice tone="error">{error}</Notice> : null}

        <Field label="Lesson" htmlFor="r-lesson">
          <div className="ac-select-wrap">
            <select id="r-lesson" name="videoId" className="ac-select" required>
              {course.lessons.map((lesson, index) => (
                <option key={lesson.id} value={lesson.id}>
                  {slateNumber(index)} · {lesson.title}
                </option>
              ))}
            </select>
          </div>
        </Field>

        <Field label="Title" htmlFor="r-title">
          <input id="r-title" name="title" className="ac-input" required />
        </Field>

        <Field label="Description" htmlFor="r-desc" hint="Optional.">
          <textarea id="r-desc" name="description" className="ac-textarea" style={{ minHeight: 70 }} />
        </Field>

        <Field label="Type" htmlFor="r-type" hint="Shown as a badge, e.g. PDF, ZIP, LUT.">
          <input id="r-type" name="fileType" className="ac-input" required placeholder="pdf" />
        </Field>

        <div className="adm-file">
          <span className="ac-label">File</span>
          <input name="resourceFile" type="file" />
          <span className="ac-hint">Or paste a link below instead.</span>
          <input name="fileUrl" className="ac-input" placeholder="https://…" />
        </div>

        <div className="ac-row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="ac-btn ac-btn--quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="ac-btn ac-btn--primary" disabled={busy}>
            {busy ? 'Adding…' : 'Add resource'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export default function AdminLessons() {
  const { courses, resources } = useLoaderData<typeof adminLessonsLoader>();
  const revalidator = useRevalidator();

  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');
  const [editing, setEditing] = useState<AdminLessonRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [addingResource, setAddingResource] = useState(false);
  const [error, setError] = useState('');

  const course = courses.find(item => item.id === courseId);
  const refresh = () => revalidator.revalidate();

  const resourceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const resource of resources) {
      if (!resource.videoId) continue;
      counts.set(resource.videoId, (counts.get(resource.videoId) ?? 0) + 1);
    }
    return counts;
  }, [resources]);

  if (courses.length === 0) {
    return (
      <section className="ac-panel adm-card">
        <EmptyState title="No courses yet">Create a course before adding lessons.</EmptyState>
      </section>
    );
  }

  return (
    <>
      <div className="page-head" style={{ paddingTop: 0 }}>
        <div className="ac-between" style={{ flexWrap: 'wrap' }}>
          <div>
            <p className="ac-eyebrow">Admin</p>
            <h1>Lessons</h1>
          </div>
          <div className="ac-row">
            <div className="ac-select-wrap" style={{ minWidth: 200 }}>
              <select
                className="ac-select"
                value={courseId}
                onChange={event => setCourseId(event.target.value)}
                aria-label="Course"
              >
                {courses.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="ac-btn ac-btn--ghost" onClick={() => setAddingResource(true)}>
              Add resource
            </button>
            <button type="button" className="ac-btn ac-btn--primary" onClick={() => setAdding(true)}>
              New lesson
            </button>
          </div>
        </div>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <section className="ac-panel adm-card">
        <div className="adm-card-head">
          <h2>{course?.title}</h2>
          <span className="adm-mini">{course?.lessons.length ?? 0} lessons</span>
        </div>

        {!course || course.lessons.length === 0 ? (
          <EmptyState title="No lessons in this course">
            Add the first lesson and it becomes lesson 01.
          </EmptyState>
        ) : (
          <div className="ac-table-wrap">
            <table className="ac-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Lesson</th>
                  <th>Duration</th>
                  <th>Source</th>
                  <th>Files</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {course.lessons.map((lesson, index) => (
                  <tr key={lesson.id}>
                    <td className="ac-mono">{slateNumber(index)}</td>
                    <td>{lesson.title}</td>
                    <td className="ac-mono">
                      {lesson.durationSec > 0 ? formatTimecode(lesson.durationSec) : '—'}
                    </td>
                    <td>
                      <span className="ac-chip">
                        {lesson.videoUrl.startsWith('/uploads/') ? 'uploaded' : 'hosted'}
                      </span>
                    </td>
                    <td>{resourceCounts.get(lesson.id) ?? 0}</td>
                    <td>
                      <div className="ac-row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="ac-btn ac-btn--quiet ac-btn--sm"
                          onClick={() => setEditing(lesson)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="ac-btn ac-btn--quiet ac-btn--sm"
                          onClick={async () => {
                            try {
                              await api.admin.deleteLesson(lesson.id);
                              refresh();
                            } catch (thrown) {
                              setError(errorMessage(thrown, 'Could not delete that lesson.'));
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {course && resources.filter(item => item.courseId === course.id).length > 0 ? (
        <section className="ac-panel adm-card">
          <div className="adm-card-head">
            <h2>Resources</h2>
          </div>
          <div className="ac-table-wrap">
            <table className="ac-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Lesson</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {resources
                  .filter(item => item.courseId === course.id)
                  .map(resource => (
                    <tr key={resource.id}>
                      <td>
                        <a href={resource.fileUrl} target="_blank" rel="noreferrer noopener">
                          {resource.title}
                        </a>
                      </td>
                      <td className="ac-mono">{resource.fileType}</td>
                      <td>
                        {course.lessons.find(lesson => lesson.id === resource.videoId)?.title ?? '—'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="ac-btn ac-btn--quiet ac-btn--sm"
                          onClick={async () => {
                            try {
                              await api.admin.deleteResource(resource.id);
                              refresh();
                            } catch (thrown) {
                              setError(errorMessage(thrown, 'Could not delete that resource.'));
                            }
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {adding && course ? (
        <LessonForm
          courseId={course.id}
          lesson={null}
          nextOrder={course.lessons.length + 1}
          onClose={() => setAdding(false)}
          onSaved={refresh}
        />
      ) : null}

      {editing && course ? (
        <LessonForm
          courseId={course.id}
          lesson={editing}
          nextOrder={editing.order}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      ) : null}

      {addingResource && course ? (
        <ResourceForm course={course} onClose={() => setAddingResource(false)} onSaved={refresh} />
      ) : null}
    </>
  );
}
