import { addResource, addVideo, updateVideo } from "@/lib/admin-actions";
import { formatCompactDate, getAdminLessonsData } from "@/lib/admin-data";

export default async function AdminLessonsPage({
  searchParams,
}: {
  searchParams?: Promise<{ adminError?: string; courseId?: string }>;
}) {
  const query = (await searchParams) ?? {};
  const { courses, lessons, resourcesByVideo } = await getAdminLessonsData();
  const selectedCourseId = query.courseId ?? courses[0]?.id ?? "";
  const visibleLessons = query.courseId ? lessons.filter(({ course }) => course.id === query.courseId) : lessons;

  return (
    <div className="admin-page-grid admin-page-grid-wide">
      <section className="card admin-operating-section">
        <div className="admin-section-heading">
          <div>
            <p>Lessons</p>
            <h2>Curriculum Manager</h2>
          </div>
          <span className="admin-count-pill">{visibleLessons.length} lessons</span>
        </div>

        {query.adminError ? (
          <div className="admin-error-box">
            <strong>Could not add lesson</strong>
            <p>{query.adminError}</p>
          </div>
        ) : null}

        <div className="admin-lesson-list">
          {visibleLessons.length === 0 ? (
            <p className="muted">No lessons yet. Add the first module from the panel.</p>
          ) : (
            visibleLessons.map(({ course, video }) => (
              <article key={video.id} className="admin-lesson-card admin-lesson-card-wide">
                <div>
                  <strong>L{video.order} - {video.title}</strong>
                  <span className="muted">{course.title}</span>
                  <small>{resourcesByVideo.get(video.id) ?? 0} resources - Updated {formatCompactDate(video.updatedAt)}</small>
                </div>
                <details className="admin-inline-editor">
                  <summary>Edit Lesson</summary>
                  <form action={updateVideo} className="admin-form-grid">
                    <input type="hidden" name="videoId" value={video.id} />
                    <input type="hidden" name="existingVideoUrl" value={video.videoUrl} />
                    <label>
                      <span>Lesson title</span>
                      <input className="input" name="title" defaultValue={video.title} required />
                    </label>
                    <label>
                      <span>Lesson Notes (supports formatting, links, images via Markdown)</span>
                      <textarea
                        className="textarea"
                        name="description"
                        rows={8}
                        defaultValue={video.description ?? ""}
                        placeholder={`## Lesson overview\nWrite rich notes with headings, bullets, links and images.\n\n[Reference Link](https://example.com)\n\n![Sample image](https://example.com/image.jpg)`}
                        required
                      />
                    </label>
                    <div className="admin-form-split">
                      <label>
                        <span>Order</span>
                        <input className="input" type="number" name="order" min={1} defaultValue={video.order} required />
                      </label>
                      <label>
                        <span>Duration seconds</span>
                        <input className="input" type="number" name="durationSec" min={0} defaultValue={video.durationSec} />
                      </label>
                    </div>
                    <label>
                      <span>Source type</span>
                      <select className="select" name="sourceType" defaultValue="url">
                        <option value="url">Keep or update URL</option>
                        <option value="upload">Upload replacement video</option>
                      </select>
                    </label>
                    <label>
                      <span>Video URL</span>
                      <input className="input" name="videoUrl" defaultValue={video.videoUrl} />
                    </label>
                    <label>
                      <span>Replacement video</span>
                      <input className="input" type="file" name="videoFile" accept="video/*" />
                    </label>
                    <button className="btn btn-primary" type="submit">
                      Save Lesson
                    </button>
                  </form>
                </details>
                <details className="admin-inline-editor">
                  <summary>Attach Resource</summary>
                  <form action={addResource} className="admin-form-grid">
                    <input type="hidden" name="courseId" value={course.id} />
                    <input type="hidden" name="videoId" value={video.id} />
                    <label>
                      <span>Resource title</span>
                      <input className="input" name="title" placeholder="Prompt sheet, project files, reference pack" required />
                    </label>
                    <div className="admin-form-split">
                      <label>
                        <span>Upload file</span>
                        <input className="input" type="file" name="resourceFile" />
                      </label>
                      <label>
                        <span>File type</span>
                        <select className="select" name="fileType" required defaultValue="pdf">
                          <option value="pdf">PDF</option>
                          <option value="image">Image</option>
                          <option value="zip">ZIP</option>
                          <option value="project">Project File</option>
                          <option value="other">Other</option>
                        </select>
                      </label>
                    </div>
                    <label>
                      <span>Or paste URL</span>
                      <input className="input" name="fileUrl" placeholder="https://..." />
                    </label>
                    <label>
                      <span>Description</span>
                      <textarea className="textarea" name="description" rows={2} />
                    </label>
                    <button className="btn btn-primary" type="submit">
                      Attach Resource
                    </button>
                  </form>
                </details>
              </article>
            ))
          )}
        </div>
      </section>

      <aside className="card admin-operating-section admin-create-panel">
        <div className="admin-section-heading">
          <div>
            <p>Create</p>
            <h2>Add Lesson</h2>
          </div>
        </div>
        <form action={addVideo} className="admin-form-grid">
          <label>
            <span>Course</span>
            <select className="select" name="courseId" required defaultValue={selectedCourseId}>
              <option value="" disabled>Select course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Lesson title</span>
            <input className="input" name="title" placeholder="What is this course about?" required />
          </label>
          <label>
            <span>Lesson Notes (supports formatting, links, images via Markdown)</span>
            <textarea
              className="textarea"
              name="description"
              rows={8}
              placeholder={`## Lesson overview\nWrite rich notes with headings, bullets, links and images.\n\n[Reference Link](https://example.com)\n\n![Sample image](https://example.com/image.jpg)`}
              required
            />
          </label>
          <label>
            <span>Source type</span>
            <select className="select" name="sourceType" defaultValue="youtube">
              <option value="youtube">YouTube / Vimeo / External URL</option>
              <option value="upload">Upload video to server</option>
            </select>
          </label>
          <label>
            <span>Video URL</span>
            <input className="input" name="videoUrl" placeholder="https://youtube.com/..." />
          </label>
          <label>
            <span>Video upload</span>
            <input className="input" type="file" name="videoFile" accept="video/*" />
          </label>
          <div className="admin-form-split">
            <label>
              <span>Order</span>
              <input className="input" type="number" name="order" min={1} defaultValue={visibleLessons.length + 1} required />
            </label>
            <label>
              <span>Duration seconds</span>
              <input className="input" type="number" name="durationSec" min={0} defaultValue={0} />
            </label>
          </div>
          <button className="btn btn-primary" type="submit">
            Add Lesson
          </button>
        </form>
      </aside>
    </div>
  );
}
