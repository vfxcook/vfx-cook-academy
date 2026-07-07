import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { redirect } from "next/navigation";

import { AdminPanelLauncher } from "@/components/AdminPanelLauncher";
import { AdminThumbnail } from "@/components/AdminThumbnail";
import { auth } from "@/lib/auth";
import { addCourseResource, getAllCourseResources } from "@/lib/course-resources";
import { prisma } from "@/lib/prisma";

const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
const SUPABASE_UPLOAD_BUCKET = "uploads";

let uploadBucketReady = false;

async function assertAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    throw new Error("Admin access required.");
  }
}

function formatCompactDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(date);
}

function toDateInputValue(date: Date | null) {
  if (!date) return "";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInput(raw: FormDataEntryValue | null) {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function isVercelRuntime() {
  return process.env.VERCEL === "1";
}

async function ensureSupabaseUploadBucket() {
  if (uploadBucketReady) return;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for production uploads.");
  }

  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };
  const bucketRes = await fetch(`${supabaseUrl}/storage/v1/bucket/${SUPABASE_UPLOAD_BUCKET}`, {
    headers,
    cache: "no-store",
  });
  if (bucketRes.ok) {
    uploadBucketReady = true;
    return;
  }
  if (bucketRes.status !== 404) {
    throw new Error("Unable to verify Supabase uploads bucket.");
  }
  const createRes = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: SUPABASE_UPLOAD_BUCKET,
      name: SUPABASE_UPLOAD_BUCKET,
      public: true,
    }),
  });
  if (!createRes.ok) {
    throw new Error("Unable to create Supabase uploads bucket.");
  }
  uploadBucketReady = true;
}

async function saveThumbnail(file: File) {
  const ext = path.extname(file.name) || ".jpg";
  const fileName = `${Date.now()}-${randomUUID()}${ext.toLowerCase()}`;
  if (!isVercelRuntime()) {
    const targetDir = path.join(process.cwd(), "public", "uploads", "thumbnails");
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(path.join(targetDir, fileName), Buffer.from(await file.arrayBuffer()));
    return `/uploads/thumbnails/${fileName}`;
  }

  await ensureSupabaseUploadBucket();
  const supabaseUrl = process.env.SUPABASE_URL as string;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  const objectPath = `thumbnails/${fileName}`;
  const uploadRes = await fetch(
    `${supabaseUrl}/storage/v1/object/${SUPABASE_UPLOAD_BUCKET}/${objectPath}`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "x-upsert": "true",
        "Content-Type": file.type || "application/octet-stream",
      },
      body: Buffer.from(await file.arrayBuffer()),
    },
  );
  if (!uploadRes.ok) {
    throw new Error("Thumbnail upload failed on production storage.");
  }
  return `${supabaseUrl}/storage/v1/object/public/${SUPABASE_UPLOAD_BUCKET}/${objectPath}`;
}

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  if (session.user.role !== "ADMIN") {
    return (
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Admin Access Denied</h1>
        <p className="muted">Only admin users can open this page.</p>
      </div>
    );
  }

  const [allCourses, allResources, recentDoubts, activeMembers] =
    await Promise.all([
      prisma.course.findMany({
        orderBy: { createdAt: "desc" },
        include: { videos: { orderBy: { order: "asc" } }, enrollments: { where: { isActive: true } } },
      }),
      getAllCourseResources(),
      prisma.timestampComment.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        include: {
          user: { select: { name: true, email: true } },
          video: { select: { title: true, order: true } },
        },
      }),
      prisma.enrollment.groupBy({
        by: ["userId"],
        where: { isActive: true },
      }),
    ]);

  const resourcesByCourse = new Map(
    allCourses.map((course) => [
      course.id,
      allResources.filter((resource) => resource.courseId === course.id),
    ]),
  );
  const resourcesByVideo = new Map<string, number>();
  for (const resource of allResources) {
    if (!resource.videoId) continue;
    resourcesByVideo.set(resource.videoId, (resourcesByVideo.get(resource.videoId) ?? 0) + 1);
  }
  const allVideos = allCourses.flatMap((course) => course.videos);
  const publishedCourses = allCourses.filter((course) => course.isPublished);
  const draftLessons = allCourses
    .filter((course) => !course.isPublished)
    .flatMap((course) => course.videos.map((video) => ({ course, video })))
    .slice(0, 5);
  const scheduledLessons = publishedCourses
    .flatMap((course) => course.videos.map((video) => ({ course, video })))
    .slice(0, 5);
  const publishedLessons = publishedCourses
    .flatMap((course) => course.videos.map((video) => ({ course, video })))
    .slice(5, 10);

  const pendingDoubts = await prisma.timestampComment.count();
  const completedProgress = await prisma.videoProgress.count({ where: { isCompleted: true } });
  const possibleProgress = Math.max(
    allCourses.reduce((sum, course) => sum + course.videos.length * course.enrollments.length, 0),
    1,
  );
  const completionRate = Math.round((completedProgress / possibleProgress) * 100);
  const lastLesson = await prisma.video.findFirst({
    orderBy: { createdAt: "desc" },
    include: { course: { select: { title: true } } },
  });

  async function createCourse(formData: FormData) {
    "use server";
    await assertAdmin();
    const slug = String(formData.get("slug") ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const thumbnailFile = formData.get("thumbnailFile");
    const availableFrom = parseDateInput(formData.get("availableFrom"));
    const priceInr = Number(formData.get("priceInr") ?? 0);
    const isPublished = String(formData.get("isPublished") ?? "") === "on";
    if (!slug || !title || !description || Number.isNaN(priceInr) || priceInr <= 0) {
      throw new Error("Missing required fields");
    }
    let thumbnailUrl: string | null = null;
    if (thumbnailFile instanceof File && thumbnailFile.size > 0) {
      if (!thumbnailFile.type.startsWith("image/")) {
        throw new Error("Thumbnail must be an image file.");
      }
      if (thumbnailFile.size > MAX_IMAGE_UPLOAD_BYTES) {
        throw new Error("Thumbnail is too large. Please use an image under 5MB.");
      }
      thumbnailUrl = await saveThumbnail(thumbnailFile);
    }
    await prisma.course.create({
      data: { slug, title, description, priceInr, isPublished, thumbnailUrl, availableFrom },
    });
    redirect("/admin");
  }

  async function updateCourse(formData: FormData) {
    "use server";
    await assertAdmin();
    const courseId = String(formData.get("courseId") ?? "").trim();
    const slug = String(formData.get("slug") ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const existingThumbnail = String(formData.get("existingThumbnail") ?? "").trim();
    const thumbnailFile = formData.get("thumbnailFile");
    const availableFrom = parseDateInput(formData.get("availableFrom"));
    const priceInr = Number(formData.get("priceInr") ?? 0);
    const isPublished = String(formData.get("isPublished") ?? "") === "on";
    if (!courseId || !slug || !title || !description || Number.isNaN(priceInr) || priceInr <= 0) {
      throw new Error("Missing required fields");
    }
    let thumbnailUrl = existingThumbnail || null;
    if (thumbnailFile instanceof File && thumbnailFile.size > 0) {
      if (!thumbnailFile.type.startsWith("image/")) {
        throw new Error("Thumbnail must be an image file.");
      }
      if (thumbnailFile.size > MAX_IMAGE_UPLOAD_BYTES) {
        throw new Error("Thumbnail is too large. Please use an image under 5MB.");
      }
      thumbnailUrl = await saveThumbnail(thumbnailFile);
    }
    await prisma.course.update({
      where: { id: courseId },
      data: { slug, title, description, priceInr, isPublished, thumbnailUrl, availableFrom },
    });
    redirect("/admin");
  }

  async function addVideo(formData: FormData) {
    "use server";
    await assertAdmin();
    const courseId = String(formData.get("courseId") ?? "");
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const sourceType = String(formData.get("sourceType") ?? "youtube");
    let videoUrl = String(formData.get("videoUrl") ?? "").trim();
    const order = Number(formData.get("order") ?? 1);
    const durationSec = Number(formData.get("durationSec") ?? 0);
    const videoFile = formData.get("videoFile");
    if (!courseId || !title || !description || Number.isNaN(order) || order < 1) {
      throw new Error("Missing required fields");
    }
    if (sourceType === "upload") {
      if (!(videoFile instanceof File) || videoFile.size <= 0) throw new Error("Video file required.");
      if (!videoFile.type.startsWith("video/")) throw new Error("Only video files are allowed.");
      const ext = path.extname(videoFile.name) || ".mp4";
      const fileName = `${Date.now()}-${randomUUID()}${ext.toLowerCase()}`;
      const targetDir = path.join(process.cwd(), "public", "uploads", "videos");
      await fs.mkdir(targetDir, { recursive: true });
      await fs.writeFile(path.join(targetDir, fileName), Buffer.from(await videoFile.arrayBuffer()));
      videoUrl = `/uploads/videos/${fileName}`;
    }
    if (!videoUrl) throw new Error("Video URL or upload is required.");
    await prisma.video.create({
      data: { courseId, title, description, videoUrl, order, durationSec: Number.isNaN(durationSec) ? 0 : durationSec },
    });
    redirect("/admin");
  }

  async function togglePublished(formData: FormData) {
    "use server";
    await assertAdmin();
    const courseId = String(formData.get("courseId") ?? "");
    const nextPublished = String(formData.get("nextPublished") ?? "") === "true";
    await prisma.course.update({ where: { id: courseId }, data: { isPublished: nextPublished } });
    redirect("/admin");
  }

  async function addResource(formData: FormData) {
    "use server";
    await assertAdmin();
    const courseId = String(formData.get("courseId") ?? "").trim();
    const videoId = String(formData.get("videoId") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const fileUrlInput = String(formData.get("fileUrl") ?? "").trim();
    const resourceFile = formData.get("resourceFile");
    const fileType = String(formData.get("fileType") ?? "").trim().toLowerCase();
    if (!courseId || !videoId || !title || !fileType) {
      throw new Error("Resource must be tied to a lesson.");
    }
    const lesson = await prisma.video.findUnique({
      where: { id: videoId },
      select: { courseId: true },
    });
    if (!lesson || lesson.courseId !== courseId) {
      throw new Error("Selected lesson does not belong to this course.");
    }
    let fileUrl = fileUrlInput;
    if (resourceFile instanceof File && resourceFile.size > 0) {
      const ext = path.extname(resourceFile.name) || "";
      const fileName = `${Date.now()}-${randomUUID()}${ext.toLowerCase()}`;
      const targetDir = path.join(process.cwd(), "public", "uploads", "resources");
      await fs.mkdir(targetDir, { recursive: true });
      await fs.writeFile(path.join(targetDir, fileName), Buffer.from(await resourceFile.arrayBuffer()));
      fileUrl = `/uploads/resources/${fileName}`;
    }
    if (!fileUrl) {
      throw new Error("Provide a resource file upload or URL.");
    }
    await addCourseResource({ courseId, videoId, title, description, fileUrl, fileType });
    redirect("/admin");
  }

  async function deleteCourse(formData: FormData) {
    "use server";
    await assertAdmin();
    const courseId = String(formData.get("courseId") ?? "").trim();
    if (!courseId) {
      throw new Error("Course id is required");
    }
    const resourceRows = await getAllCourseResources();
    const keptRows = resourceRows.filter((row) => row.courseId !== courseId);
    if (keptRows.length !== resourceRows.length) {
      const resourceFilePath = path.join(process.cwd(), "data", "course-resources.json");
      await fs.mkdir(path.dirname(resourceFilePath), { recursive: true });
      await fs.writeFile(resourceFilePath, JSON.stringify(keptRows, null, 2), "utf8");
    }
    await prisma.course.delete({ where: { id: courseId } });
    redirect("/admin");
  }

  const kpis = [
    { label: "Published Courses", value: String(publishedCourses.length), trend: "Live now", icon: "📚" },
    { label: "Draft Courses", value: String(allCourses.length - publishedCourses.length), trend: "Need publish", icon: "🗂️" },
    { label: "Total Lessons", value: String(allVideos.length), trend: "Across all courses", icon: "🎬" },
    { label: "Resources", value: String(allResources.length), trend: "Course materials", icon: "📦" },
    { label: "Active Learners", value: String(activeMembers.length), trend: "Currently enrolled", icon: "👥" },
    { label: "New Community Doubts", value: String(recentDoubts.length), trend: "Latest activity", icon: "💬" },
  ];

  return (
    <div className="admin-dashboard">
      <section className="card admin-command-hero">
        <div>
          <h1 style={{ margin: 0 }}>Owner Command Center</h1>
          <p className="muted" style={{ margin: "0.45rem 0 0" }}>
            Manage courses, students, payments, lessons, resources, and community activity from one cinematic dashboard.
          </p>
        </div>
        <div className="admin-command-actions">
          <AdminPanelLauncher targetId="add-lesson-panel" label="+ Add Lesson" variant="primary" />
          <AdminPanelLauncher targetId="create-course-panel" label="+ Create Course" variant="primary" />
        </div>
      </section>

      <section className="admin-kpi-grid">
        {kpis.map((kpi) => (
          <article key={kpi.label} className="card admin-kpi-card">
            <span>{kpi.icon}</span>
            <strong>{kpi.value}</strong>
            <p>{kpi.label}</p>
            <small>{kpi.trend}</small>
          </article>
        ))}
      </section>

      <section className="admin-action-panels">
        <details id="create-course-panel" className="card admin-panel">
          <summary>Create Course</summary>
          <form action={createCourse} className="admin-form-grid">
            <input className="input" name="title" placeholder="Course title" required />
            <input className="input" name="slug" placeholder="course-slug" required />
            <textarea className="textarea" name="description" rows={4} placeholder="Course description" required />
            <input className="input" type="number" name="priceInr" min={1} placeholder="Price in INR" required />
            <input className="input" type="date" name="availableFrom" />
            <input className="input" type="file" name="thumbnailFile" accept="image/*" />
            <label className="muted"><input type="checkbox" name="isPublished" /> Publish immediately</label>
            <button className="btn btn-primary" type="submit">Create Course</button>
          </form>
        </details>

        <details id="add-lesson-panel" className="card admin-panel">
          <summary>Add Lesson</summary>
          <form action={addVideo} className="admin-form-grid">
            <select className="select" name="courseId" required defaultValue="">
              <option value="" disabled>Select course</option>
              {allCourses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
            <input className="input" name="title" placeholder="Lesson title" required />
            <textarea className="textarea" name="description" rows={3} placeholder="Lesson description" required />
            <select className="select" name="sourceType" defaultValue="youtube">
              <option value="youtube">YouTube / Vimeo / External URL</option>
              <option value="upload">Upload video to server</option>
            </select>
            <input className="input" name="videoUrl" placeholder="https://youtube.com/... or https://vimeo.com/..." />
            <input className="input" type="file" name="videoFile" accept="video/*" />
            <div className="admin-form-split">
              <input className="input" type="number" name="order" min={1} defaultValue={1} required />
              <input className="input" type="number" name="durationSec" min={0} defaultValue={0} />
            </div>
            <button className="btn btn-primary" type="submit">Add Lesson</button>
          </form>
        </details>

      </section>

      <div className="admin-main-grid">
        <div className="admin-main-column">
          <section className="card" style={{ display: "grid", gap: "0.75rem" }}>
            <h2 style={{ margin: 0 }}>Course Management</h2>
            <div className="admin-course-grid">
              {allCourses.map((course) => (
                <article key={course.id} className="admin-course-row">
                  <div className="admin-course-main">
                    <AdminThumbnail src={course.thumbnailUrl} alt={course.title} />
                    <div style={{ display: "grid", gap: "0.35rem" }}>
                      <strong>{course.title}</strong>
                      <span className="muted">{course.slug}</span>
                      <div className="admin-chip-row">
                        <span>₹{course.priceInr}</span>
                        <span>
                          {course.availableFrom
                            ? `Starts ${formatCompactDate(course.availableFrom)}`
                            : "Starts immediately"}
                        </span>
                        <span className={course.isPublished ? "admin-badge-published" : "admin-badge-draft"}>
                          {course.isPublished ? "Published" : "Draft"}
                        </span>
                        <span>{course.videos.length} videos</span>
                        <span>{(resourcesByCourse.get(course.id) ?? []).length} resources</span>
                        <span>{course.enrollments.length} students</span>
                        <span>Updated {formatCompactDate(course.updatedAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="admin-course-actions">
                    <AdminPanelLauncher targetId="add-lesson-panel" label="Add Lesson" variant="secondary" />
                    <a className="btn btn-secondary" href={`/course/${course.slug}`}>Preview</a>
                    <form action={togglePublished}>
                      <input type="hidden" name="courseId" value={course.id} />
                      <input type="hidden" name="nextPublished" value={String(!course.isPublished)} />
                      <button className="btn btn-primary" type="submit">{course.isPublished ? "Unpublish" : "Publish"}</button>
                    </form>
                    <details className="admin-inline-editor">
                      <summary className="btn btn-secondary">Delete Course</summary>
                      <form action={deleteCourse} className="admin-form-grid">
                        <input type="hidden" name="courseId" value={course.id} />
                        <p className="muted" style={{ margin: 0 }}>
                          This will remove the course, videos, enrollments, and linked resources.
                        </p>
                        <button className="btn btn-secondary" type="submit">Confirm Delete</button>
                      </form>
                    </details>
                  </div>
                  <details className="admin-inline-editor admin-course-editor">
                    <summary className="btn btn-secondary">Edit Course</summary>
                    <form action={updateCourse} className="admin-form-grid">
                      <input type="hidden" name="courseId" value={course.id} />
                      <input type="hidden" name="existingThumbnail" value={course.thumbnailUrl ?? ""} />
                      <input className="input" name="title" defaultValue={course.title} required />
                      <input className="input" name="slug" defaultValue={course.slug} required />
                      <textarea className="textarea" name="description" rows={3} defaultValue={course.description} required />
                      <input className="input" type="number" name="priceInr" min={1} defaultValue={course.priceInr} required />
                        <input
                          className="input"
                          type="date"
                          name="availableFrom"
                          defaultValue={toDateInputValue(course.availableFrom)}
                        />
                      <input className="input" type="file" name="thumbnailFile" accept="image/*" />
                      <label className="muted"><input type="checkbox" name="isPublished" defaultChecked={course.isPublished} /> Published</label>
                      <button className="btn btn-primary" type="submit">Save</button>
                    </form>
                    <div style={{ marginTop: "0.7rem", borderTop: "1px solid #2b3f69", paddingTop: "0.7rem" }}>
                      <h4 style={{ margin: "0 0 0.45rem" }}>Attach Resource to Lesson</h4>
                      {course.videos.length === 0 ? (
                        <p className="muted" style={{ margin: 0 }}>
                          Add at least one lesson first, then attach resources here.
                        </p>
                      ) : (
                        <form action={addResource} className="admin-form-grid">
                          <input type="hidden" name="courseId" value={course.id} />
                          <select className="select" name="videoId" required defaultValue="">
                            <option value="" disabled>Select lesson</option>
                            {course.videos.map((video) => (
                              <option key={video.id} value={video.id}>
                                L{video.order} - {video.title}
                              </option>
                            ))}
                          </select>
                          <input className="input" name="title" placeholder="Resource title" required />
                          <input className="input" type="file" name="resourceFile" />
                          <input className="input" name="fileUrl" placeholder="Or paste resource URL" />
                          <select className="select" name="fileType" required defaultValue="pdf">
                            <option value="pdf">PDF</option>
                            <option value="image">Image</option>
                            <option value="zip">ZIP</option>
                            <option value="project">Project File</option>
                            <option value="other">Other</option>
                          </select>
                          <textarea className="textarea" name="description" rows={2} placeholder="Description" />
                          <button className="btn btn-primary" type="submit">Attach Resource</button>
                        </form>
                      )}
                    </div>
                  </details>
                </article>
              ))}
            </div>
          </section>

          <section className="card">
            <h2 style={{ marginTop: 0 }}>Content Pipeline</h2>
            <div className="admin-kanban">
              <div className="admin-kanban-col">
                <h3>Draft Lessons</h3>
                {draftLessons.length === 0 ? <p className="muted">No draft lessons</p> : draftLessons.map(({ video, course }) => (
                  <article key={video.id} className="admin-lesson-card">
                    <strong>{video.title}</strong>
                    <span className="muted">Module {video.order} • {course.title}</span>
                    <span className="muted">Status: Draft • Resources: {resourcesByVideo.get(video.id) ?? 0}</span>
                    <a className="btn btn-secondary" href="#add-lesson-panel">Edit</a>
                  </article>
                ))}
              </div>
              <div className="admin-kanban-col">
                <h3>Scheduled Lessons</h3>
                {scheduledLessons.length === 0 ? <p className="muted">No scheduled lessons</p> : scheduledLessons.map(({ video, course }) => (
                  <article key={video.id} className="admin-lesson-card">
                    <strong>{video.title}</strong>
                    <span className="muted">Module {video.order} • {course.title}</span>
                    <span className="muted">Status: Scheduled • Resources: {resourcesByVideo.get(video.id) ?? 0}</span>
                    <a className="btn btn-secondary" href="#add-lesson-panel">Edit</a>
                  </article>
                ))}
              </div>
              <div className="admin-kanban-col">
                <h3>Published Lessons</h3>
                {publishedLessons.length === 0 ? <p className="muted">No published lessons</p> : publishedLessons.map(({ video, course }) => (
                  <article key={video.id} className="admin-lesson-card">
                    <strong>{video.title}</strong>
                    <span className="muted">Module {video.order} • {course.title}</span>
                    <span className="muted">Status: Live • Resources: {resourcesByVideo.get(video.id) ?? 0}</span>
                    <a className="btn btn-secondary" href={`/course/${course.slug}`}>Preview</a>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="card">
            <h2 style={{ marginTop: 0 }}>Recent Community Doubts</h2>
            <div style={{ display: "grid", gap: "0.5rem" }}>
              {recentDoubts.length === 0 ? <p className="muted">No recent doubts.</p> : recentDoubts.map((comment) => (
                <article key={comment.id} className="admin-doubt-row">
                  <div>
                    <strong>{comment.user.name ?? comment.user.email ?? "Student"}</strong>
                    <p className="muted" style={{ margin: "0.25rem 0 0" }}>
                      Lesson {comment.video.order} • {comment.video.title} • {formatCompactDate(comment.createdAt)}
                    </p>
                    <p style={{ margin: "0.3rem 0 0" }}>{comment.text.slice(0, 130)}</p>
                  </div>
                  <div style={{ display: "grid", gap: "0.4rem", justifyItems: "end" }}>
                    <span className="admin-badge-published">New</span>
                    <button className="btn btn-secondary" type="button">Reply</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="admin-sidebar">
          <section className="card">
            <h3 style={{ marginTop: 0 }}>Quick Actions</h3>
            <div className="admin-quick-actions">
              <AdminPanelLauncher targetId="create-course-panel" label="+ Create New Course" />
              <AdminPanelLauncher targetId="add-lesson-panel" label="+ Add Video Lesson" />
            </div>
          </section>

          <section className="card">
            <h3 style={{ marginTop: 0 }}>Course Health</h3>
            <div style={{ display: "grid", gap: "0.55rem" }}>
              <p style={{ margin: 0 }}>Completion Rate <strong>{completionRate}%</strong></p>
              <p style={{ margin: 0 }}>Active Learners <strong>{activeMembers.length}</strong></p>
              <p style={{ margin: 0 }}>Pending Doubts <strong>{pendingDoubts}</strong></p>
              <p style={{ margin: 0 }}>
                Last Uploaded Lesson{" "}
                <strong>{lastLesson ? `L${lastLesson.order} - ${lastLesson.title}` : "No lessons yet"}</strong>
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
