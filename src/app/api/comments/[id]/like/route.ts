import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const comment = await prisma.timestampComment.findUnique({
    where: { id },
    include: {
      video: { select: { courseId: true } },
    },
  });

  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: session.user.id,
        courseId: comment.video.courseId,
      },
    },
  });

  if (!isAdmin && !enrollment?.isActive) {
    return NextResponse.json({ error: "Enroll and activate license first." }, { status: 403 });
  }

  const existing = await prisma.timestampCommentLike.findUnique({
    where: {
      commentId_userId: {
        commentId: id,
        userId: session.user.id,
      },
    },
  });

  if (existing) {
    await prisma.timestampCommentLike.delete({ where: { id: existing.id } });
  } else {
    await prisma.timestampCommentLike.create({
      data: {
        commentId: id,
        userId: session.user.id,
      },
    });
  }

  const likeCount = await prisma.timestampCommentLike.count({ where: { commentId: id } });

  return NextResponse.json({ liked: !existing, likeCount });
}
