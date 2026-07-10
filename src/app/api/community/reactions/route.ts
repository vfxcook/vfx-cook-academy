import { NextResponse } from "next/server";
import { z } from "zod";

import { CommunityReactionType, NotificationType } from "@/generated/prisma";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const reactionSchema = z.object({
  postId: z.string().min(1),
  type: z.nativeEnum(CommunityReactionType),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = reactionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { postId, type } = parsed.data;
  const post = await prisma.communityPost.findUnique({
    where: { id: postId },
    select: { id: true, userId: true, courseId: true },
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

  const existing = await prisma.communityPostReaction.findUnique({
    where: {
      postId_userId_type: {
        postId,
        userId: session.user.id,
        type,
      },
    },
  });

  if (existing) {
    await prisma.communityPostReaction.delete({ where: { id: existing.id } });
    return NextResponse.json({ active: false });
  }

  await prisma.communityPostReaction.create({
    data: {
      postId,
      userId: session.user.id,
      type,
    },
  });

  if (post.userId !== session.user.id) {
    await prisma.notification.create({
      data: {
        userId: post.userId,
        actorUserId: session.user.id,
        type: NotificationType.REACTION_ON_POST,
        title: "New reaction on your post",
        message: `Someone reacted with ${type.toLowerCase()} to your post.`,
        courseId: post.courseId,
        postId: post.id,
      },
    });
  }

  return NextResponse.json({ active: true });
}
