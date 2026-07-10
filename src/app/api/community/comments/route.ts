import { NextResponse } from "next/server";
import { z } from "zod";

import { NotificationType } from "@/generated/prisma";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createCommentSchema = z.object({
  postId: z.string().min(1),
  parentId: z.string().min(1).optional(),
  content: z.string().min(2).max(800),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createCommentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { postId, parentId, content } = parsed.data;
  const post = await prisma.communityPost.findUnique({
    where: { id: postId },
    include: {
      course: {
        select: { id: true },
      },
    },
  });
  if (!post) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  if (!isAdmin) {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: session.user.id,
          courseId: post.courseId,
        },
      },
      select: { isActive: true },
    });
    if (!enrollment?.isActive) {
      return NextResponse.json({ error: "Course access required." }, { status: 403 });
    }
  }

  const parentComment = parentId
    ? await prisma.communityPostComment.findUnique({
        where: { id: parentId },
        select: { id: true, postId: true, userId: true },
      })
    : null;
  if (parentId && (!parentComment || parentComment.postId !== postId)) {
    return NextResponse.json({ error: "Invalid parent comment." }, { status: 400 });
  }

  const comment = await prisma.communityPostComment.create({
    data: {
      postId,
      userId: session.user.id,
      parentId: parentComment?.id ?? null,
      content,
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  });

  const notifications: Array<{
    userId: string;
    actorUserId: string;
    type: NotificationType;
    title: string;
    message: string;
    courseId: string;
    postId: string;
    commentId: string;
  }> = [];

  if (parentComment && parentComment.userId !== session.user.id) {
    notifications.push({
      userId: parentComment.userId,
      actorUserId: session.user.id,
      type: NotificationType.REPLY_ON_COMMENT,
      title: "New reply on your comment",
      message: content.slice(0, 180),
      courseId: post.courseId,
      postId,
      commentId: comment.id,
    });
  } else if (!parentComment && post.userId !== session.user.id) {
    notifications.push({
      userId: post.userId,
      actorUserId: session.user.id,
      type: NotificationType.COMMENT_ON_POST,
      title: "New comment on your post",
      message: content.slice(0, 180),
      courseId: post.courseId,
      postId,
      commentId: comment.id,
    });
  }

  if (notifications.length > 0) {
    await prisma.notification.createMany({
      data: notifications,
    });
  }

  return NextResponse.json({ comment });
}
