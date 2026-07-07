import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const commentSchema = z.object({
  videoId: z.string().min(1),
  timestamp: z.number().int().min(0),
  text: z.string().min(2).max(400),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = commentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { videoId, timestamp, text } = parsed.data;

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    include: { course: true },
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
    return NextResponse.json(
      { error: "Enroll and activate license first." },
      { status: 403 },
    );
  }

  const comment = await prisma.timestampComment.create({
    data: {
      userId: session.user.id,
      videoId,
      timestamp,
      text,
    },
    include: {
      user: { select: { name: true, image: true, email: true } },
    },
  });

  return NextResponse.json({ comment });
}
