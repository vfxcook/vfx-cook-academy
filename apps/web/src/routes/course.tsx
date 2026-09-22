import { Link, useLoaderData, type LoaderFunctionArgs } from 'react-router';
import { Notice } from '../components/ui';
import { api } from '../lib/api';
import { formatDate, formatInr, formatRuntime, formatTimecode, slateNumber } from '../lib/format';
import '../styles/course.css';

export async function courseLoader({ params }: LoaderFunctionArgs) {
  return api.courses.detail(params.slug!);
}

function Tick() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 7.5l3.2 3.2L12 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="syl-lock" width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="2.5" y="6" width="9" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4.5 6V4.2a2.5 2.5 0 0 1 5 0V6" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export default function Course() {
  const { course, lessons, progress, access } = useLoaderData<typeof courseLoader>();
  const previewLesson = lessons.find(lesson => !lesson.isLocked);

  return (
    <div className="ac-shell" style={{ paddingBottom: 'clamp(48px, 7vw, 88px)' }}>
      <div className="course-hero">
        <div className="course-hero-copy">
          <div className="ac-row" style={{ gap: 6 }}>
            <span className="ac-chip ac-chip--ember">Malayalam</span>
            <span className="ac-chip">{course.lessonCount} lessons</span>
            <span className="ac-chip">{formatRuntime(course.totalDurationSec)}</span>
            {course.studentCount > 0 ? (
              <span className="ac-chip">{course.studentCount} enrolled</span>
            ) : null}
          </div>

          <h1>{course.title}</h1>
          <p className="ac-lede">{course.description}</p>

          {access.hasAccess ? (
            <div className="ac-row">
              <Link className="ac-btn ac-btn--ember ac-btn--lg" to={`/learn/${course.slug}`}>
                {progress.completed === 0 ? 'Start the course' : 'Continue where you left off'}
              </Link>
              <Link className="ac-btn ac-btn--ghost ac-btn--lg" to={`/learn/${course.slug}/community`}>
                Community wall
              </Link>
            </div>
          ) : null}

          {access.awaitingLicense ? (
            <Notice tone="ok">
              Your payment is approved. Enter the license code we emailed you on your{' '}
              <Link to="/dashboard">dashboard</Link> to unlock the lessons.
            </Notice>
          ) : null}

          {access.pendingPayment ? (
            <Notice tone="warn">
              We have your payment reference{' '}
              <span className="ac-mono">{access.pendingPayment.transactionRef}</span> under review
              since {formatDate(access.pendingPayment.createdAt)}. You will get an email once it
              clears.
            </Notice>
          ) : null}
        </div>

        {!access.hasAccess ? (
          <aside className="ac-panel course-buy">
            <p className="ac-eyebrow">Enrolment</p>

            <div className="course-buy-price">
              <b>{formatInr(course.priceInr)}</b>
              <span>one-time · lifetime access</span>
            </div>

            <ul className="course-buy-facts">
              <li>
                <Tick />
                <span>{course.lessonCount} lessons · {formatRuntime(course.totalDurationSec)}</span>
              </li>
              <li>
                <Tick />
                <span>Downloadable project files and references</span>
              </li>
              <li>
                <Tick />
                <span>Timestamped doubt threads on every lesson</span>
              </li>
              <li>
                <Tick />
                <span>Community wall to post your shots and get notes</span>
              </li>
              <li>
                <Tick />
                <span>New lessons added to the course stay included</span>
              </li>
            </ul>

            <Link className="ac-btn ac-btn--primary ac-btn--lg ac-btn--block" to={`/checkout/${course.slug}`}>
              Enrol now
            </Link>

            {previewLesson ? (
              <Link
                className="ac-btn ac-btn--ghost ac-btn--block"
                to={`/learn/${course.slug}/${previewLesson.id}`}
              >
                Watch lesson 01 free
              </Link>
            ) : null}

            <p className="ac-hint" style={{ textAlign: 'center' }}>
              Buying for someone else?{' '}
              <Link to={`/checkout/${course.slug}?gift=1`}>Gift this course</Link>
            </p>

            {course.availableFrom ? (
              <p className="ac-hint" style={{ textAlign: 'center' }}>
                Batch opens {formatDate(course.availableFrom)}
              </p>
            ) : null}
          </aside>
        ) : null}
      </div>

      <section aria-labelledby="syllabus-heading">
        <div className="page-head">
          <p className="ac-eyebrow">Syllabus</p>
          <h2 id="syllabus-heading" className="ac-title">
            {course.lessonCount} lessons, in order
          </h2>
          <p className="ac-lede">
            Lessons open one after another. Finishing a lesson unlocks the next, so the craft stacks
            the way it does on a real production.
          </p>
        </div>

        {lessons.length === 0 ? (
          <Notice>Lessons are being uploaded. They will show up here as they land.</Notice>
        ) : (
          <div className="syllabus">
            {lessons.map((lesson, index) => {
              const body = (
                <>
                  <span className="syl-no">{slateNumber(index)}</span>
                  <span className="syl-body">
                    <strong>{lesson.title}</strong>
                    <span>
                      {lesson.durationSec > 0 ? formatTimecode(lesson.durationSec) : 'Duration TBA'}
                      {lesson.resources.length > 0
                        ? ` · ${lesson.resources.length} resource${lesson.resources.length > 1 ? 's' : ''}`
                        : ''}
                    </span>
                  </span>
                  <span className="syl-meta">
                    {lesson.isCompleted ? (
                      <span className="ac-chip ac-chip--ok">Done</span>
                    ) : !lesson.isLocked && index === 0 && !access.hasAccess ? (
                      <span className="ac-chip ac-chip--ember">Free</span>
                    ) : lesson.isLocked ? (
                      <LockIcon />
                    ) : (
                      <span className="ac-chip">Open</span>
                    )}
                  </span>
                </>
              );

              return lesson.isLocked ? (
                <div key={lesson.id} className="syl-row" data-locked>
                  {body}
                </div>
              ) : (
                <Link
                  key={lesson.id}
                  className="syl-row"
                  data-done={lesson.isCompleted || undefined}
                  to={`/learn/${course.slug}/${lesson.id}`}
                >
                  {body}
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
