import { useMemo, useState } from 'react';
import { useLoaderData } from 'react-router';
import CourseCard from '../components/CourseCard';
import { EmptyState } from '../components/ui';
import { api } from '../lib/api';

export async function coursesLoader() {
  return api.courses.list();
}

type Filter = 'all' | 'enrolled' | 'open';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Everything' },
  { id: 'enrolled', label: 'My courses' },
  { id: 'open', label: 'Open to join' }
];

export default function Courses() {
  const { courses } = useLoaderData<typeof coursesLoader>();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return courses.filter(course => {
      if (filter === 'enrolled' && !course.isEnrolled) return false;
      if (filter === 'open' && course.isEnrolled) return false;
      if (!needle) return true;
      return (
        course.title.toLowerCase().includes(needle) ||
        course.description.toLowerCase().includes(needle)
      );
    });
  }, [courses, filter, query]);

  const enrolledCount = courses.filter(course => course.isEnrolled).length;

  return (
    <div className="ac-shell" style={{ paddingBottom: 'clamp(48px, 7vw, 88px)' }}>
      <div className="page-head">
        <p className="ac-eyebrow">The catalogue</p>
        <h1>Courses</h1>
        <p className="ac-lede">
          Every course runs the same six-stage pipeline as brahmastra.studio, taught in Malayalam
          with the technical terms kept in English.
        </p>
      </div>

      <div className="ac-between" style={{ flexWrap: 'wrap', marginBottom: 24, gap: 12 }}>
        <div className="ac-row" role="tablist" aria-label="Filter courses">
          {FILTERS.map(item => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              className={`ac-btn ac-btn--sm ${filter === item.id ? 'ac-btn--ghost' : 'ac-btn--quiet'}`}
              onClick={() => setFilter(item.id)}
              disabled={item.id === 'enrolled' && enrolledCount === 0}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="ac-field" style={{ minWidth: 220, maxWidth: 300, flex: '1 1 220px' }}>
          <label className="ac-sr-only" htmlFor="course-search">
            Search courses
          </label>
          <input
            id="course-search"
            className="ac-input"
            type="search"
            placeholder="Search courses…"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState title={courses.length === 0 ? 'No courses published yet' : 'Nothing matches that'}>
          {courses.length === 0
            ? 'The first batch is being cut right now. Check back shortly.'
            : 'Try a different search, or clear the filter to see everything.'}
        </EmptyState>
      ) : (
        <div className="ac-grid">
          {visible.map(course => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}
