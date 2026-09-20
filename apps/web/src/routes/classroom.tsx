import { useRef, useState } from 'react';
import { Link, redirect, useLoaderData, type LoaderFunctionArgs } from 'react-router';
import DoubtThread from '../components/DoubtThread';
import LessonPlayer, { type PlayerHandle } from '../components/LessonPlayer';
import { Meter, Notice } from '../components/ui';
import { api } from '../lib/api';
import { formatTimecode, slateNumber } from '../lib/format';
import '../styles/classroom.css';

/** /learn/:slug drops you at the next unwatched lesson rather than a landing page. */
export async function classroomIndexLoader({ params }: LoaderFunctionArgs) {
  const data = await api.courses.detail(params.slug!);
  const target =
    data.lessons.find(lesson => !lesson.isCompleted && !lesson.isLocked) ??
    data.lessons.find(lesson => !lesson.isLocked) ??
    data.lessons[0];

  if (!target) return redirect(`/courses/${params.slug}`);
  return redirect(`/learn/${params.slug}/${target.id}`);
}

export async function classroomLoader({ params }: LoaderFunctionArgs) {
  return api.courses.classroom(params.slug!, params.lessonId!);
}

export default function Classroom() {
  const { course, lesson, lessons, progress, comments } = useLoaderData<typeof classroomLoader>();
  const playerRef = useRef<PlayerHandle>(null);
  const [completed, setCompleted] = useState(lesson.isCompleted);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState('');

  const index = lessons.findIndex(item => item.id === lesson.id);
  const next = lessons.slice(index + 1).find(item => !item.isLocked || completed);

  const markComplete = async () => {
    setMarking(true);
    setError('');
    try {
      await api.courses.saveProgress({ videoId: lesson.id, progressPercent: 100, isCompleted: true });
      setCompleted(true);
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : 'Could not save that.');
    } finally {
      setMarking(false);
    }
  };

  return (
    <div className="ac-shell room">
      <aside className="ac-panel room-rail" aria-label="Lessons">
        <div className="room-rail-head">
          <p className="ac-eyebrow">Course</p>
          <h2>
            <Link to={`/courses/${course.slug}`}>{course.title}</Link>
          </h2>
          <Meter percent={progress.percent} label="Course progress" />
          <span className="ac-mono ac-muted" style={{ fontSize: 11 }}>
            {progress.completed}/{progress.total} lessons · {progress.percent}%
          </span>
          <Link className="ac-btn ac-btn--ghost ac-btn--sm" to={`/learn/${course.slug}/community`}>
            Community wall
          </Link>
        </div>

        <div className="room-rail-list">
          {lessons.map((item, itemIndex) => {
            const isCurrent = item.id === lesson.id;
            const done = isCurrent ? completed : item.isCompleted;
            const body = (
              <>
                <b>{done ? '✓' : slateNumber(itemIndex)}</b>
                <span>{item.title}</span>
                <small>{item.durationSec > 0 ? formatTimecode(item.durationSec) : '—'}</small>
              </>
            );

            return item.isLocked ? (
              <div key={item.id} className="room-lesson" data-locked title="Finish the previous lesson to unlock">
                {body}
              </div>
            ) : (
              <Link
                key={item.id}
                className="room-lesson"
                aria-current={isCurrent}
                data-done={done || undefined}
                to={`/learn/${course.slug}/${item.id}`}
              >
                {body}
              </Link>
            );
          })}
        </div>
      </aside>

      <div className="room-stage">
        {lesson.videoUrl ? (
          <LessonPlayer
            key={lesson.id}
            ref={playerRef}
            lessonId={lesson.id}
            title={lesson.title}
            videoUrl={lesson.videoUrl}
            isCompleted={completed}
            onProgress={(_percent, isCompleted) => {
              if (isCompleted) setCompleted(true);
            }}
          />
        ) : (
          <div className="ac-panel room-locked">
            <h3>This lesson is locked</h3>
            <p>Finish the lesson before it to unlock this one.</p>
          </div>
        )}

        <div className="room-head">
          <p className="ac-eyebrow">
            Lesson {slateNumber(index)} of {String(lessons.length).padStart(2, '0')}
          </p>
          <h1>{lesson.title}</h1>

          <div className="room-actions">
            {completed ? (
              <span className="ac-chip ac-chip--ok">
                <span className="ac-dot" />
                Completed
              </span>
            ) : (
              <button
                type="button"
                className="ac-btn ac-btn--ember"
                onClick={markComplete}
                disabled={marking}
              >
                {marking ? 'Saving…' : 'Mark as complete'}
              </button>
            )}

            {next ? (
              <Link className="ac-btn ac-btn--ghost" to={`/learn/${course.slug}/${next.id}`}>
                Next lesson →
              </Link>
            ) : completed ? (
              <span className="ac-chip ac-chip--ember">Final lesson — course complete</span>
            ) : null}

            {lesson.durationSec > 0 ? (
              <span className="ac-chip">{formatTimecode(lesson.durationSec)}</span>
            ) : null}
          </div>

          {error ? <Notice tone="error">{error}</Notice> : null}

          {!completed && next === undefined && index < lessons.length - 1 ? (
            <Notice>Finish this lesson to unlock the next one.</Notice>
          ) : null}
        </div>

        {lesson.descriptionHtml ? (
          <section aria-labelledby="notes-heading">
            <p className="ac-eyebrow" id="notes-heading">
              Lesson notes
            </p>
            <div
              className="room-notes"
              // Sanitised on the server before it is stored, and again on render there.
              dangerouslySetInnerHTML={{ __html: lesson.descriptionHtml }}
            />
          </section>
        ) : null}

        {lesson.resources.length > 0 ? (
          <section aria-labelledby="files-heading">
            <p className="ac-eyebrow" id="files-heading">
              Project files
            </p>
            <div className="room-files">
              {lesson.resources.map(resource => (
                <a
                  key={resource.id}
                  className="room-file"
                  href={resource.fileUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  download
                >
                  <span className="room-file-type">{resource.fileType}</span>
                  <span>
                    <strong>{resource.title}</strong>
                    {resource.description ? <span>{resource.description}</span> : null}
                  </span>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M8 2v9M4.5 7.5L8 11l3.5-3.5M2.5 13.5h11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              ))}
            </div>
          </section>
        ) : null}

        <DoubtThread
          key={lesson.id}
          lessonId={lesson.id}
          videoUrl={lesson.videoUrl}
          comments={comments}
          canPost={!lesson.isLocked}
          currentTime={() => playerRef.current?.currentTime() ?? 0}
          onSeek={seconds => playerRef.current?.seekTo(seconds)}
        />
      </div>
    </div>
  );
}
