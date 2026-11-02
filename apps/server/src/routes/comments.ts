import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../lib/auth.js';
import { forbidden, notFound, parse, route } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { shapeComment } from './courses.js';

export const commentsRouter = Router();

commentsRouter.use(requireUser);

async function assertCourseAccess(userId: string, role: string, courseId: string) {
  if (role === 'ADMIN') return;
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { isActive: true }
  });
  if (!enrollment?.isActive) throw forbidden('Activate this course to join the discussion.');
}

const withAuthor = {
  user: { select: { id: true, name: true, email: true, image: true } },
  likes: { select: { userId: true } }
} as const;

commentsRouter.post(
  '/',
  route(async (req, res) => {
    const data = parse(
      z.object({
        videoId: z.string().min(1),
        parentId: z.string().min(1).optional(),
        timestamp: z.number().int().min(0),
        text: z.string().trim().min(2, 'Write a little more.').max(400)
      }),
      req.body
    );

    const video = await prisma.video.findUnique({
      where: { id: data.videoId },
      select: { id: true, courseId: true }
    });
    if (!video) throw notFound('Lesson not found.');
    await assertCourseAccess(req.user!.id, req.user!.role, video.courseId);

    if (data.parentId) {
      const parent = await prisma.timestampComment.findUnique({
        where: { id: data.parentId },
        select: { videoId: true, parentId: true }
      });
      // Threads stay one level deep: replies attach to top-level notes only.
      if (!parent || parent.videoId !== data.videoId || parent.parentId) {
        throw notFound('That comment is no longer there.');
      }
    }

    const comment = await prisma.timestampComment.create({
      data: {
        userId: req.user!.id,
        videoId: data.videoId,
        parentId: data.parentId,
        timestamp: data.timestamp,
        text: data.text
      },
      include: { ...withAuthor, replies: { include: withAuthor } }
    });

    res.status(201).json({ comment: shapeComment(comment, req.user!) });
  })
);

commentsRouter.post(
  '/:id/like',
  route(async (req, res) => {
    const comment = await prisma.timestampComment.findUnique({
      where: { id: req.params.id },
      include: { video: { select: { courseId: true } } }
    });
    if (!comment) throw notFound('That comment is no longer there.');
    await assertCourseAccess(req.user!.id, req.user!.role, comment.video.courseId);

    const existing = await prisma.timestampCommentLike.findUnique({
      where: { commentId_userId: { commentId: comment.id, userId: req.user!.id } }
    });

    if (existing) {
      await prisma.timestampCommentLike.delete({ where: { id: existing.id } });
    } else {
      await prisma.timestampCommentLike.create({
        data: { commentId: comment.id, userId: req.user!.id }
      });
    }

    const likeCount = await prisma.timestampCommentLike.count({ where: { commentId: comment.id } });
    res.json({ liked: !existing, likeCount });
  })
);

commentsRouter.delete(
  '/:id',
  route(async (req, res) => {
    const comment = await prisma.timestampComment.findUnique({
      where: { id: req.params.id },
      select: { id: true, userId: true }
    });
    if (!comment) throw notFound('That comment is no longer there.');

    if (comment.userId !== req.user!.id && req.user!.role !== 'ADMIN') {
      throw forbidden('You can only delete your own comments.');
    }

    await prisma.timestampComment.delete({ where: { id: comment.id } });
    res.json({ ok: true });
  })
);
