import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const progressSchema = z.object({
  videoId: z.string().min(1),
  progressPercent: z.number().int().min(0).max(100),
  isCompleted: z.boolean().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = progressSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { videoId, progressPercent, isCompleted } = parsed.data;
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { id: true, courseId: true, order: true },
  });
  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: session.user.id,
        courseId: video.courseId,
      },
    },
  });
  if (!enrollment?.isActive) {
    return NextResponse.json({ error: "Course access required" }, { status: 403 });
  }

  const previousVideos = await prisma.video.findMany({
    where: {
      courseId: video.courseId,
      order: { lt: video.order },
    },
    select: { id: true },
  });
  const previousVideoIds = previousVideos.map((item) => item.id);
  if (previousVideoIds.length > 0) {
    const previousCompletedCount = await prisma.videoProgress.count({
      where: {
        userId: session.user.id,
        videoId: { in: previousVideoIds },
        isCompleted: true,
      },
    });
    const isTryingToAdvance = Boolean(isCompleted || progressPercent >= 100 || progressPercent > 0);
    if (isTryingToAdvance && previousCompletedCount < previousVideoIds.length) {
      return NextResponse.json(
        { error: "Finish previous lesson first to unlock this video." },
        { status: 403 },
      );
    }
  }

  const row = await prisma.videoProgress.upsert({
    where: {
      userId_videoId: {
        userId: session.user.id,
        videoId,
      },
    },
    create: {
      userId: session.user.id,
      videoId,
      progressPercent,
      isCompleted: Boolean(isCompleted || progressPercent >= 100),
    },
    update: {
      progressPercent,
      isCompleted: Boolean(isCompleted || progressPercent >= 100),
    },
  });

  return NextResponse.json({ progress: row });
}
