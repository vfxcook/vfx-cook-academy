import Link from "next/link";

import { AdminThumbnail } from "@/components/AdminThumbnail";
import { createCourse, deleteCourse, togglePublished } from "@/lib/admin-actions";
import { formatCompactDate, getAdminCourses } from "@/lib/admin-data";
import { formatInr } from "@/lib/utils";

export default async function AdminCoursesPage() {
  const courses = await getAdminCourses();

  return (
    <div className="admin-page-grid admin-page-grid-wide">
      <section className="card admin-operating-section">
        <div className="admin-section-heading">
          <div>
            <p>Courses</p>
            <h2>Course Library</h2>
          </div>
          <span className="admin-count-pill">{courses.length} courses</span>
        </div>

        <div className="admin-course-list">
          {courses.length === 0 ? (
            <p className="muted">No courses yet. Create your first course from the form.</p>
          ) : (
            courses.map((course) => (
              <article key={course.id} className="admin-course-row admin-course-row-clean">
                <div className="admin-course-main">
                  <AdminThumbnail src={course.thumbnailUrl} alt={course.title} />
                  <div>
                    <strong>{course.title}</strong>
                    <span className="muted">{course.slug}</span>
                    <div className="admin-chip-row">
                      <span>{formatInr(course.priceInr)}</span>
                      <span>{course.availableFrom ? `Starts ${formatCompactDate(course.availableFrom)}` : "Starts immediately"}</span>
                      <span className={course.isPublished ? "admin-badge-published" : "admin-badge-draft"}>
                        {course.isPublished ? "Published" : "Draft"}
                      </span>
                      <span>{course.videos.length} lessons</span>
                      <span>{course.enrollments.length} students</span>
                    </div>
                  </div>
                </div>
                <div className="admin-course-actions admin-course-actions-clean">
                  <Link className="btn btn-primary" href={`/admin/courses/${course.id}/edit`}>
                    Edit Course
                  </Link>
                  <Link className="btn btn-secondary" href={`/admin/lessons?courseId=${course.id}`}>
                    Lessons
                  </Link>
                  <Link className="btn btn-secondary" href={`/course/${course.slug}`}>
                    Preview
                  </Link>
                  <form action={togglePublished}>
                    <input type="hidden" name="courseId" value={course.id} />
                    <input type="hidden" name="nextPublished" value={String(!course.isPublished)} />
                    <button className="btn btn-secondary" type="submit">
                      {course.isPublished ? "Unpublish" : "Publish"}
                    </button>
                  </form>
                  <details className="admin-danger-details">
                    <summary>Delete</summary>
                    <form action={deleteCourse}>
                      <input type="hidden" name="courseId" value={course.id} />
                      <p className="muted">Deletes the course, lessons, enrollments, and resources.</p>
                      <button className="btn btn-secondary" type="submit">
                        Confirm Delete
                      </button>
                    </form>
                  </details>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <aside className="card admin-operating-section admin-create-panel">
        <div className="admin-section-heading">
          <div>
            <p>Create</p>
            <h2>New Course</h2>
          </div>
        </div>
        <form action={createCourse} className="admin-form-grid">
          <label>
            <span>Course title</span>
            <input className="input" name="title" placeholder="Master Cinematic AI Video Creation" required />
          </label>
          <label>
            <span>Slug</span>
            <input className="input" name="slug" placeholder="cinematic-ai-video" required />
          </label>
          <label>
            <span>Description</span>
            <textarea className="textarea" name="description" rows={5} placeholder="What students will learn" required />
          </label>
          <div className="admin-form-split">
            <label>
              <span>Price</span>
              <input className="input" type="number" name="priceInr" min={1} defaultValue={499} required />
            </label>
            <label>
              <span>Start date</span>
              <input className="input" type="date" name="availableFrom" />
            </label>
          </div>
          <label>
            <span>Thumbnail</span>
            <input className="input" type="file" name="thumbnailFile" accept="image/*" />
          </label>
          <label className="admin-check-row">
            <input type="checkbox" name="isPublished" />
            <span>Publish immediately</span>
          </label>
          <label className="admin-check-row">
            <input type="checkbox" name="freePreviewFirstLesson" defaultChecked />
            <span>Allow first lesson as free preview</span>
          </label>
          <button className="btn btn-primary" type="submit">
            Create Course
          </button>
        </form>
      </aside>
    </div>
  );
}
