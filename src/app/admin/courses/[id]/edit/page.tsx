import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminThumbnail } from "@/components/AdminThumbnail";
import { updateCourse } from "@/lib/admin-actions";
import { toDateInputValue } from "@/lib/admin-data";
import { prisma } from "@/lib/prisma";

export default async function AdminCourseEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const course = await prisma.course.findUnique({
    where: { id },
    include: { videos: { orderBy: { order: "asc" } }, enrollments: { where: { isActive: true } } },
  });

  if (!course) notFound();

  return (
    <section className="card admin-operating-section admin-course-studio">
      <div className="admin-section-heading">
        <div>
          <p>Course Studio</p>
          <h2>Edit Course</h2>
        </div>
        <div className="admin-heading-actions">
          <Link className="btn btn-secondary" href="/admin/courses">
            Back
          </Link>
          <Link className="btn btn-secondary" href={`/admin/lessons?courseId=${course.id}`}>
            Lessons
          </Link>
          <Link className="btn btn-secondary" href={`/course/${course.slug}`}>
            Preview
          </Link>
        </div>
      </div>

      <div className="admin-editor-layout">
        <aside className="admin-editor-summary">
          <AdminThumbnail src={course.thumbnailUrl} alt={course.title} />
          <strong>{course.title}</strong>
          <span>{course.slug}</span>
          <div className="admin-chip-row">
            <span>{course.videos.length} lessons</span>
            <span>{course.enrollments.length} students</span>
            <span className={course.isPublished ? "admin-badge-published" : "admin-badge-draft"}>
              {course.isPublished ? "Published" : "Draft"}
            </span>
          </div>
        </aside>

        <form action={updateCourse} className="admin-form-grid admin-editor-form">
          <input type="hidden" name="courseId" value={course.id} />
          <input type="hidden" name="existingThumbnail" value={course.thumbnailUrl ?? ""} />

          <section className="admin-form-section">
            <div>
              <p>Basics</p>
              <h3>Public course information</h3>
            </div>
            <label>
              <span>Title</span>
              <input className="input" name="title" defaultValue={course.title} required />
            </label>
            <label>
              <span>Slug</span>
              <input className="input" name="slug" defaultValue={course.slug} required />
            </label>
            <label>
              <span>Description</span>
              <textarea className="textarea" name="description" rows={6} defaultValue={course.description} required />
            </label>
          </section>

          <section className="admin-form-section">
            <div>
              <p>Commercials</p>
              <h3>Pricing and access date</h3>
            </div>
            <div className="admin-form-split">
              <label>
                <span>Price in INR</span>
                <input className="input" type="number" name="priceInr" min={1} defaultValue={course.priceInr} required />
              </label>
              <label>
                <span>Available from</span>
                <input className="input" type="date" name="availableFrom" defaultValue={toDateInputValue(course.availableFrom)} />
              </label>
            </div>
          </section>

          <section className="admin-form-section">
            <div>
              <p>Media</p>
              <h3>Thumbnail and publish state</h3>
            </div>
            <label>
              <span>Replace thumbnail</span>
              <input className="input" type="file" name="thumbnailFile" accept="image/*" />
            </label>
            <label className="admin-check-row">
              <input type="checkbox" name="isPublished" defaultChecked={course.isPublished} />
              <span>Course is published</span>
            </label>
            <label className="admin-check-row">
              <input
                type="checkbox"
                name="freePreviewFirstLesson"
                defaultChecked={course.freePreviewFirstLesson}
              />
              <span>Allow first lesson as free preview</span>
            </label>
          </section>

          <button className="btn btn-primary admin-save-button" type="submit">
            Save Course
          </button>
        </form>
      </div>
    </section>
  );
}
