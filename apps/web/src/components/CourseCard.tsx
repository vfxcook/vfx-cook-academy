import { Link } from 'react-router';
import { formatInr, formatRuntime } from '../lib/format';
import type { CourseSummary, DashboardCourse } from '../lib/types';
import { Meter } from './ui';
import '../styles/course.css';

function Poster({ src, title }: { src: string | null; title: string }) {
  if (src) return <img src={src} alt="" loading="lazy" />;
  return (
    <div className="cc-poster-fallback" aria-hidden="true">
      <svg viewBox="0 0 120 76" fill="none">
        <rect x="1" y="1" width="118" height="74" rx="4" stroke="currentColor" strokeOpacity=".2" />
        <path d="M1 12h118M1 64h118" stroke="currentColor" strokeOpacity=".12" />
        {[10, 30, 50, 70, 90, 110].map(x => (
          <rect key={x} x={x - 4} y="3" width="8" height="6" rx="1" fill="currentColor" fillOpacity=".12" />
        ))}
        {[10, 30, 50, 70, 90, 110].map(x => (
          <rect key={x} x={x - 4} y="67" width="8" height="6" rx="1" fill="currentColor" fillOpacity=".12" />
        ))}
        <path d="M50 30l22 12-22 12z" fill="currentColor" fillOpacity=".22" />
      </svg>
      <span className="ac-slate">{title.slice(0, 2)}</span>
    </div>
  );
}

export default function CourseCard({ course }: { course: CourseSummary }) {
  const isFree = course.priceInr === 0;

  return (
    <article className="ac-panel cc">
      <Link className="cc-poster" to={`/courses/${course.slug}`} aria-label={course.title}>
        <Poster src={course.thumbnailUrl} title={course.title} />
        <span className="cc-poster-marks" aria-hidden="true">
          <i />
          <i />
        </span>
        {course.isEnrolled ? <span className="ac-chip ac-chip--ok cc-flag">Enrolled</span> : null}
        {!course.isEnrolled && course.freePreviewFirstLesson ? (
          <span className="ac-chip ac-chip--ember cc-flag">Free lesson 01</span>
        ) : null}
      </Link>

      <div className="cc-body">
        <div className="ac-row" style={{ gap: 6 }}>
          <span className="ac-chip">{course.lessonCount} lessons</span>
          <span className="ac-chip">{formatRuntime(course.totalDurationSec)}</span>
          {course.studentCount > 0 ? (
            <span className="ac-chip">{course.studentCount} enrolled</span>
          ) : null}
        </div>

        <h3 className="cc-title">
          <Link to={`/courses/${course.slug}`}>{course.title}</Link>
        </h3>
        <p className="cc-desc">{course.description}</p>

        <div className="cc-foot">
          <span className="cc-price">{isFree ? 'Free' : formatInr(course.priceInr)}</span>
          {course.isEnrolled ? (
            <Link className="ac-btn ac-btn--ember ac-btn--sm" to={`/learn/${course.slug}`}>
              Continue
            </Link>
          ) : course.awaitingLicense ? (
            <Link className="ac-btn ac-btn--ghost ac-btn--sm" to="/dashboard">
              Activate license
            </Link>
          ) : (
            <Link className="ac-btn ac-btn--primary ac-btn--sm" to={`/courses/${course.slug}`}>
              View syllabus
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

export function EnrolledCourseCard({ course }: { course: DashboardCourse }) {
  const done = course.percent >= 100;

  return (
    <article className="ac-panel cc">
      <Link className="cc-poster" to={`/learn/${course.slug}`} aria-label={course.title}>
        <Poster src={course.thumbnailUrl} title={course.title} />
        <span className="cc-poster-marks" aria-hidden="true">
          <i />
          <i />
        </span>
        {done ? <span className="ac-chip ac-chip--ok cc-flag">Complete</span> : null}
      </Link>

      <div className="cc-body">
        <h3 className="cc-title">
          <Link to={`/learn/${course.slug}`}>{course.title}</Link>
        </h3>

        {course.isActive ? (
          <>
            <div className="cc-progress">
              <Meter percent={course.percent} label={`${course.title} progress`} />
              <span className="ac-mono">
                {course.completedLessons}/{course.lessonCount} · {course.percent}%
              </span>
            </div>
            <div className="cc-foot">
              <span className="ac-chip">{formatRuntime(course.totalDurationSec)}</span>
              <Link className="ac-btn ac-btn--ember ac-btn--sm" to={`/learn/${course.slug}`}>
                {course.completedLessons === 0 ? 'Start' : done ? 'Rewatch' : 'Continue'}
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="cc-desc">
              {course.awaitingLicense
                ? 'Your payment is approved. Enter the license code we emailed you to unlock the lessons.'
                : 'Your payment is under review. We will email your license code once it clears.'}
            </p>
            <div className="cc-foot">
              <span className={`ac-chip ${course.awaitingLicense ? 'ac-chip--ember' : 'ac-chip--warn'}`}>
                {course.awaitingLicense ? 'License ready' : 'Under review'}
              </span>
              {course.awaitingLicense ? (
                <a className="ac-btn ac-btn--primary ac-btn--sm" href="#activate">
                  Activate
                </a>
              ) : null}
            </div>
          </>
        )}
      </div>
    </article>
  );
}
