"use server";

import { redirect } from "next/navigation";

import { NotificationType } from "@/generated/prisma";
import { auth } from "@/lib/auth";
import { addCourseResource } from "@/lib/course-resources";
import { prisma } from "@/lib/prisma";
import { saveUploadFile } from "@/lib/storage";

const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;

export async function assertAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    throw new Error("Admin access required.");
  }
  return session;
}

function parseDateInput(raw: FormDataEntryValue | null) {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function redirectAdminWithError(message: string, target = "/admin/lessons"): never {
  redirect(`${target}?adminError=${encodeURIComponent(message)}`);
}

export async function createCourse(formData: FormData) {
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
  const freePreviewFirstLesson = String(formData.get("freePreviewFirstLesson") ?? "") === "on";
  const isPublished = String(formData.get("isPublished") ?? "") === "on";

  if (!slug || !title || !description || Number.isNaN(priceInr) || priceInr <= 0) {
    throw new Error("Missing required course fields.");
  }

  let thumbnailUrl: string | null = null;
  if (thumbnailFile instanceof File && thumbnailFile.size > 0) {
    if (!thumbnailFile.type.startsWith("image/")) {
      throw new Error("Thumbnail must be an image file.");
    }
    if (thumbnailFile.size > MAX_IMAGE_UPLOAD_BYTES) {
      throw new Error("Thumbnail is too large. Please use an image under 5MB.");
    }
    thumbnailUrl = await saveUploadFile(thumbnailFile, "thumbnails");
  }

  await prisma.course.create({
    data: {
      slug,
      title,
      description,
      priceInr,
      isPublished,
      thumbnailUrl,
      availableFrom,
      freePreviewFirstLesson,
    },
  });
  redirect("/admin/courses");
}

export async function updateCourse(formData: FormData) {
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
  const freePreviewFirstLesson = String(formData.get("freePreviewFirstLesson") ?? "") === "on";
  const isPublished = String(formData.get("isPublished") ?? "") === "on";

  if (!courseId || !slug || !title || !description || Number.isNaN(priceInr) || priceInr <= 0) {
    throw new Error("Missing required course fields.");
  }

  let thumbnailUrl = existingThumbnail || null;
  if (thumbnailFile instanceof File && thumbnailFile.size > 0) {
    if (!thumbnailFile.type.startsWith("image/")) {
      throw new Error("Thumbnail must be an image file.");
    }
    if (thumbnailFile.size > MAX_IMAGE_UPLOAD_BYTES) {
      throw new Error("Thumbnail is too large. Please use an image under 5MB.");
    }
    thumbnailUrl = await saveUploadFile(thumbnailFile, "thumbnails");
  }

  await prisma.course.update({
    where: { id: courseId },
    data: {
      slug,
      title,
      description,
      priceInr,
      isPublished,
      thumbnailUrl,
      availableFrom,
      freePreviewFirstLesson,
    },
  });
  redirect(`/admin/courses/${courseId}/edit`);
}

export async function togglePublished(formData: FormData) {
  await assertAdmin();
  const courseId = String(formData.get("courseId") ?? "");
  const nextPublished = String(formData.get("nextPublished") ?? "") === "true";
  await prisma.course.update({ where: { id: courseId }, data: { isPublished: nextPublished } });
  redirect("/admin/courses");
}

export async function deleteCourse(formData: FormData) {
  await assertAdmin();
  const courseId = String(formData.get("courseId") ?? "").trim();
  if (!courseId) throw new Error("Course id is required.");
  await prisma.courseResource.deleteMany({ where: { courseId } });
  await prisma.course.delete({ where: { id: courseId } });
  redirect("/admin/courses");
}

export async function createTrendingPrompt(formData: FormData) {
  await assertAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const prompt = String(formData.get("prompt") ?? "").trim();
  const sortOrder = Number(formData.get("sortOrder") ?? 1);
  const imageFile = formData.get("imageFile");
  const isPublished = String(formData.get("isPublished") ?? "") === "on";

  if (!title || prompt.length < 8) {
    throw new Error("Prompt title and prompt text are required.");
  }
  if (!(imageFile instanceof File) || imageFile.size <= 0) {
    throw new Error("Prompt image is required.");
  }
  if (!imageFile.type.startsWith("image/")) {
    throw new Error("Prompt image must be an image file.");
  }
  if (imageFile.size > MAX_IMAGE_UPLOAD_BYTES) {
    throw new Error("Prompt image is too large. Please use an image under 5MB.");
  }

  const imageUrl = await saveUploadFile(imageFile, "prompts");

  await prisma.trendingPrompt.create({
    data: {
      title,
      prompt,
      imageUrl,
      isPublished,
      sortOrder: Number.isNaN(sortOrder) ? 1 : sortOrder,
    },
  });
  redirect("/admin/prompts");
}

export async function updateTrendingPromptStatus(formData: FormData) {
  await assertAdmin();
  const promptId = String(formData.get("promptId") ?? "").trim();
  const isPublished = String(formData.get("isPublished") ?? "") === "true";
  if (!promptId) throw new Error("Prompt id is required.");

  await prisma.trendingPrompt.update({
    where: { id: promptId },
    data: { isPublished },
  });
  redirect("/admin/prompts");
}

export async function deleteTrendingPrompt(formData: FormData) {
  await assertAdmin();
  const promptId = String(formData.get("promptId") ?? "").trim();
  if (!promptId) throw new Error("Prompt id is required.");

  await prisma.trendingPrompt.delete({ where: { id: promptId } });
  redirect("/admin/prompts");
}

export async function addVideo(formData: FormData) {
  const actorSession = await assertAdmin();
  const courseId = String(formData.get("courseId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const sourceType = String(formData.get("sourceType") ?? "youtube");
  let videoUrl = String(formData.get("videoUrl") ?? "").trim();
  const order = Number(formData.get("order") ?? 1);
  const durationSec = Number(formData.get("durationSec") ?? 0);
  const videoFile = formData.get("videoFile");

  if (!courseId || !title || !description || Number.isNaN(order) || order < 1) {
    redirectAdminWithError("Missing required lesson fields.");
  }
  if (sourceType === "upload") {
    if (!(videoFile instanceof File) || videoFile.size <= 0) {
      redirectAdminWithError("Video file is required when source type is upload.");
    }
    if (!videoFile.type.startsWith("video/")) {
      redirectAdminWithError("Only video files are allowed for lesson upload.");
    }
    videoUrl = await saveUploadFile(videoFile, "videos");
  }
  if (!videoUrl) {
    redirectAdminWithError("Provide a Video URL or choose Upload with a video file.");
  }

  const createdVideo = await prisma.video.create({
    data: {
      courseId,
      title,
      description,
      videoUrl,
      order,
      durationSec: Number.isNaN(durationSec) ? 0 : durationSec,
    },
  });
  const courseInfo = await prisma.course.findUnique({ where: { id: courseId }, select: { title: true } });
  const activeEnrollments = await prisma.enrollment.findMany({
    where: { courseId, isActive: true },
    select: { userId: true },
  });

  if (activeEnrollments.length > 0) {
    await prisma.notification.createMany({
      data: activeEnrollments.map((enrollment) => ({
        userId: enrollment.userId,
        actorUserId: actorSession.user.id,
        type: NotificationType.NEW_VIDEO_IN_ENROLLED_COURSE,
        title: "New lesson published",
        message: `${title} is now available in ${courseInfo?.title ?? "your course"}.`,
        courseId,
        videoId: createdVideo.id,
      })),
    });
  }
  redirect("/admin/lessons");
}

export async function updateVideo(formData: FormData) {
  await assertAdmin();
  const videoId = String(formData.get("videoId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const order = Number(formData.get("order") ?? 1);
  const durationSec = Number(formData.get("durationSec") ?? 0);
  const sourceType = String(formData.get("sourceType") ?? "url");
  const existingVideoUrl = String(formData.get("existingVideoUrl") ?? "").trim();
  const videoUrlInput = String(formData.get("videoUrl") ?? "").trim();
  const videoFile = formData.get("videoFile");

  if (!videoId || !title || !description || Number.isNaN(order) || order < 1) {
    throw new Error("Missing required lesson fields.");
  }

  let videoUrl = videoUrlInput || existingVideoUrl;
  if (sourceType === "upload") {
    if (!(videoFile instanceof File) || videoFile.size <= 0) throw new Error("Video file required.");
    if (!videoFile.type.startsWith("video/")) throw new Error("Only video files are allowed.");
    videoUrl = await saveUploadFile(videoFile, "videos");
  }
  if (!videoUrl) throw new Error("Video URL or upload is required.");

  await prisma.video.update({
    where: { id: videoId },
    data: { title, description, order, durationSec: Number.isNaN(durationSec) ? 0 : durationSec, videoUrl },
  });
  redirect("/admin/lessons");
}

export async function addResource(formData: FormData) {
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
  const lesson = await prisma.video.findUnique({ where: { id: videoId }, select: { courseId: true } });
  if (!lesson || lesson.courseId !== courseId) {
    throw new Error("Selected lesson does not belong to this course.");
  }

  let fileUrl = fileUrlInput;
  if (resourceFile instanceof File && resourceFile.size > 0) {
    fileUrl = await saveUploadFile(resourceFile, "resources");
  }
  if (!fileUrl) throw new Error("Provide a resource file upload or URL.");

  await addCourseResource({ courseId, videoId, title, description, fileUrl, fileType });
  redirect("/admin/lessons");
}
