import { NextResponse } from "next/server";
import { z } from "zod";

import { NotificationType } from "@/generated/prisma";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveUploadFile } from "@/lib/storage";

const createPostSchema = z.object({
  courseId: z.string().min(1),
  title: z.string().min(2).max(140),
  caption: z.string().min(2).max(1500),
  mediaUrl: z.string().url().optional().or(z.literal("")),
});
const MAX_COMMUNITY_IMAGE_BYTES = 6 * 1024 * 1024;

async function canAccessCourse(userId: string, role: string | undefined, courseId: string) {
  if (role === "ADMIN") return true;
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId,
        courseId,
      },
    },
    select: { isActive: true },
  });
  return Boolean(enrollment?.isActive);
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId")?.trim();
  if (!courseId) {
    return NextResponse.json({ error: "courseId is required." }, { status: 400 });
  }

  const allowed = await canAccessCourse(session.user.id, session.user.role, courseId);
  if (!allowed) {
    return NextResponse.json({ error: "Course access required." }, { status: 403 });
  }

  const posts = await prisma.communityPost.findMany({
    where: { courseId },
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { id: true, name: true, email: true, image: true },
      },
      reactions: {
        select: { type: true, userId: true },
      },
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      },
    },
  });

  return NextResponse.json({ posts });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let payload: { courseId: string; title: string; caption: string; mediaUrl: string };
  let mediaFile: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    payload = {
      courseId: String(formData.get("courseId") ?? "").trim(),
      title: String(formData.get("title") ?? "").trim(),
      caption: String(formData.get("caption") ?? "").trim(),
      mediaUrl: String(formData.get("mediaUrl") ?? "").trim(),
    };
    const maybeFile = formData.get("mediaFile");
    mediaFile = maybeFile instanceof File && maybeFile.size > 0 ? maybeFile : null;
  } else {
    const json = (await request.json()) as unknown;
    const parsedJson = createPostSchema.safeParse(json);
    if (!parsedJson.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsedJson.error.flatten() },
        { status: 400 },
      );
    }
    payload = {
      courseId: parsedJson.data.courseId,
      title: parsedJson.data.title,
      caption: parsedJson.data.caption,
      mediaUrl: parsedJson.data.mediaUrl ?? "",
    };
  }

  const parsed = createPostSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { courseId, title, caption, mediaUrl } = parsed.data;
  const allowed = await canAccessCourse(session.user.id, session.user.role, courseId);
  if (!allowed) {
    return NextResponse.json({ error: "Course access required." }, { status: 403 });
  }

  let finalMediaUrl = mediaUrl?.trim() ? mediaUrl.trim() : null;
  if (mediaFile) {
    if (!mediaFile.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image uploads are allowed for student work." }, { status: 400 });
    }
    if (mediaFile.size > MAX_COMMUNITY_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Image too large. Please upload image under 6MB." },
        { status: 400 },
      );
    }
    finalMediaUrl = await saveUploadFile(mediaFile, "community");
  }

  const post = await prisma.communityPost.create({
    data: {
      courseId,
      userId: session.user.id,
      title,
      caption,
      mediaUrl: finalMediaUrl,
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, image: true },
      },
      reactions: {
        select: { type: true, userId: true },
      },
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      },
    },
  });

  const activeEnrollments = await prisma.enrollment.findMany({
    where: {
      courseId,
      isActive: true,
    },
    select: { userId: true },
  });
  const recipientUserIds = new Set(activeEnrollments.map((enrollment) => enrollment.userId));
  recipientUserIds.add(session.user.id);

  if (recipientUserIds.size > 0) {
    await prisma.notification.createMany({
      data: Array.from(recipientUserIds).map((recipientUserId) => ({
        userId: recipientUserId,
        actorUserId: session.user.id,
        type: NotificationType.NEW_POST_IN_ENROLLED_COURSE,
        title: "New student post in community",
        message: title.slice(0, 180),
        courseId,
        postId: post.id,
      })),
    });
  }

  return NextResponse.json({ post });
}
