"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { formatInr } from "@/lib/utils";

type CourseCard = {
  id: string;
  slug: string;
  title: string;
  description: string;
  priceInr: number;
  thumbnailUrl: string | null;
  lessonsCount: number;
  availableFrom: string | null;
  isEnrolled: boolean;
  isActiveEnrollment: boolean;
};

const FEATURED_PREVIEW_VIDEO =
  "https://player.vimeo.com/video/1207857088?title=0&byline=0&portrait=0&speed=0&dnt=1";

function getPrimaryHref(
  slug: string,
  isLoggedIn: boolean,
  isAdmin: boolean,
  isEnrolled: boolean,
  isActiveEnrollment: boolean,
) {
  if (isAdmin) return `/course/${slug}`;
  if (isActiveEnrollment) return `/course/${slug}`;
  if (isEnrolled) return `/checkout/${slug}`;
  if (isLoggedIn) return `/checkout/${slug}`;
  return `/register?next=${encodeURIComponent(`/checkout/${slug}`)}`;
}

function getPrimaryLabel(isLoggedIn: boolean, isAdmin: boolean, isEnrolled: boolean, isActiveEnrollment: boolean) {
  if (isAdmin || isActiveEnrollment) return "View Course";
  if (isEnrolled) return "Complete Payment";
  if (isLoggedIn) return "Join Now";
  return "Join Now";
}

export function CoursesCatalogClient({
  courses,
  isLoggedIn,
  isAdmin,
}: {
  courses: CourseCard[];
  isLoggedIn: boolean;
  isAdmin: boolean;
}) {
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? null,
    [courses, selectedCourseId],
  );
  const now = Date.now();

  return (
    <>
      <section className="courses-grid">
        {courses.length === 0 ? (
          <article className="card">
            <h2 style={{ marginTop: 0 }}>No published courses yet</h2>
            <p className="muted" style={{ marginBottom: 0 }}>
              Admin can publish courses from the admin panel to show them here.
            </p>
          </article>
        ) : (
          courses.map((course) => (
            <article key={course.id} className="card course-vertical-card">
              <div className="course-vertical-media">
                {course.thumbnailUrl ? (
                  <img
                    src={course.thumbnailUrl}
                    alt={course.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <div className="course-vertical-fallback">Course Thumbnail</div>
                )}
              </div>
              <div style={{ display: "grid", gap: "0.45rem", alignContent: "start" }}>
                <h2 style={{ margin: 0 }}>{course.title}</h2>
                <p className="muted" style={{ margin: 0 }}>
                  {course.description}
                </p>
                <div style={{ display: "flex", gap: "0.7rem", alignItems: "center", flexWrap: "wrap" }}>
                  <strong>{formatInr(course.priceInr)}</strong>
                  <span className="muted">{course.lessonsCount} lessons</span>
                  {course.availableFrom ? (
                    new Date(course.availableFrom).getTime() > now ? (
                      <span className="begin-highlight">
                        Begins {new Date(course.availableFrom).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                    ) : (
                      <span className="muted">Now available</span>
                    )
                  ) : (
                    <span className="muted">Now available</span>
                  )}
                </div>
              </div>
              <div className="course-vertical-actions">
                <Link
                  className="btn btn-primary"
                  href={getPrimaryHref(
                    course.slug,
                    isLoggedIn,
                    isAdmin,
                    course.isEnrolled,
                    course.isActiveEnrollment,
                  )}
                >
                  {getPrimaryLabel(isLoggedIn, isAdmin, course.isEnrolled, course.isActiveEnrollment)}
                </Link>
                <Link
                  className="btn btn-secondary"
                  href={`/checkout/${course.slug}?gift=true`}
                  title="Buy this course as a gift for someone else"
                >
                  Gift Course
                </Link>
                <button className="btn btn-secondary" type="button" onClick={() => setSelectedCourseId(course.id)}>
                  View Details
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      {selectedCourse ? (
        <div className="course-modal-overlay" role="dialog" aria-modal="true">
          <div className="course-modal-card">
            <button className="course-modal-close" type="button" onClick={() => setSelectedCourseId(null)}>
              ✕
            </button>
            <div className="course-modal-video-wrap">
              <iframe
                src={FEATURED_PREVIEW_VIDEO}
                title="Course Preview Video"
                allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media"
                allowFullScreen
                style={{
                  width: "100%",
                  height: "100%",
                  border: "1px solid #2f436a",
                  borderRadius: 12,
                }}
              />
            </div>
            <h2 style={{ marginTop: 0 }}>{selectedCourse.title}</h2>
            <p className="muted">{selectedCourse.description}</p>
            <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", marginBottom: "0.7rem" }}>
              <strong>{formatInr(selectedCourse.priceInr)}</strong>
              <span className="muted">{selectedCourse.lessonsCount} lessons</span>
              {selectedCourse.availableFrom ? (
                new Date(selectedCourse.availableFrom).getTime() > now ? (
                  <span className="begin-highlight">
                    Begins {new Date(selectedCourse.availableFrom).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                ) : (
                  <span className="muted">Now available</span>
                )
              ) : (
                <span className="muted">Now available</span>
              )}
            </div>
            <div className="course-vertical-actions">
              <Link
                className="btn btn-primary"
                href={getPrimaryHref(
                  selectedCourse.slug,
                  isLoggedIn,
                  isAdmin,
                  selectedCourse.isEnrolled,
                  selectedCourse.isActiveEnrollment,
                )}
              >
                {getPrimaryLabel(
                  isLoggedIn,
                  isAdmin,
                  selectedCourse.isEnrolled,
                  selectedCourse.isActiveEnrollment,
                )}
              </Link>
              <Link
                className="btn btn-secondary"
                href={`/checkout/${selectedCourse.slug}?gift=true`}
                title="Buy this course as a gift for someone else"
              >
                Gift Course
              </Link>
              <button className="btn btn-secondary" type="button" onClick={() => setSelectedCourseId(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
