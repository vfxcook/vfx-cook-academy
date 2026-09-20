import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../lib/auth.js';
import { badRequest, forbidden, notFound, parse, route } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { buildLessons, courseProgress } from '../lib/serialize.js';

export const coursesRouter = Router();

async function progressMap(userId: string | undefined, videoIds: string[]) {
  const map = new Map<string, { progressPercent: number; isCompleted: boolean }>();
  if (!userId || videoIds.length === 0) return map;

  const rows = await prisma.videoProgress.findMany({
    where: { userId, videoId: { in: videoIds } },
    select: { videoId: true, progressPercent: true, isCompleted: true }
  });
  for (const row of rows) {
    map.set(row.videoId, { progressPercent: row.progressPercent, isCompleted: row.isCompleted });
  }
  return map;
}

coursesRouter.get(
  '/',
  route(async (req, res) => {
    const courses = await prisma.course.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: 'desc' },
      include: {
        videos: { select: { id: true, durationSec: true } },
        _count: { select: { enrollments: { where: { isActive: true } } } }
      }
    });

    const enrollments = req.user
      ? await prisma.enrollment.findMany({
          where: { userId: req.user.id },
          select: { courseId: true, isActive: true, licenseCode: true }
        })
      : [];
    const byCourse = new Map(enrollments.map(row => [row.courseId, row]));

    res.json({
      courses: courses.map(course => {
        const enrollment = byCourse.get(course.id);
        return {
          id: course.id,
          slug: course.slug,
          title: course.title,
          description: course.description,
          priceInr: course.priceInr,
          thumbnailUrl: course.thumbnailUrl,
          availableFrom: course.availableFrom,
          freePreviewFirstLesson: course.freePreviewFirstLesson,
          lessonCount: course.videos.length,
          totalDurationSec: course.videos.reduce((sum, video) => sum + video.durationSec, 0),
          studentCount: course._count.enrollments,
          isEnrolled: Boolean(enrollment?.isActive),
          awaitingLicense: Boolean(enrollment && !enrollment.isActive && enrollment.licenseCode)
        };
      })
    });
  })
);

coursesRouter.get(
  '/:slug',
  route(async (req, res) => {
    const course = await prisma.course.findUnique({
      where: { slug: req.params.slug },
      include: {
        videos: { orderBy: { order: 'asc' } },
        resources: true,
        _count: { select: { enrollments: { where: { isActive: true } } } }
      }
    });
    if (!course || (!course.isPublished && req.user?.role !== 'ADMIN')) throw notFound('Course not found.');

    const enrollment = req.user
      ? await prisma.enrollment.findUnique({
          where: { userId_courseId: { userId: req.user.id, courseId: course.id } }
        })
      : null;

    const hasAccess = Boolean(enrollment?.isActive) || req.user?.role === 'ADMIN';
    const lessons = buildLessons({
      videos: course.videos,
      resources: course.resources,
      progressByVideo: await progressMap(req.user?.id, course.videos.map(video => video.id)),
      hasAccess,
      freePreviewFirstLesson: course.freePreviewFirstLesson
    });

    const pendingPayment = req.user
      ? await prisma.paymentRequest.findFirst({
          where: { userId: req.user.id, courseId: course.id, status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
          select: { id: true, transactionRef: true, createdAt: true }
        })
      : null;

    res.json({
      course: {
        id: course.id,
        slug: course.slug,
        title: course.title,
        description: course.description,
        priceInr: course.priceInr,
        thumbnailUrl: course.thumbnailUrl,
        availableFrom: course.availableFrom,
        freePreviewFirstLesson: course.freePreviewFirstLesson,
        isPublished: course.isPublished,
        lessonCount: course.videos.length,
        totalDurationSec: course.videos.reduce((sum, video) => sum + video.durationSec, 0),
        studentCount: course._count.enrollments
      },
      lessons,
      progress: courseProgress(lessons),
      access: {
        hasAccess,
        isEnrolled: Boolean(enrollment),
        awaitingLicense: Boolean(enrollment && !enrollment.isActive && enrollment.licenseCode),
        pendingPayment
      }
    });
  })
);

coursesRouter.get(
  '/:slug/lessons/:lessonId',
  route(async (req, res) => {
    const course = await prisma.course.findUnique({
      where: { slug: req.params.slug },
      include: { videos: { orderBy: { order: 'asc' } }, resources: true }
    });
    if (!course) throw notFound('Course not found.');

    const enrollment = req.user
      ? await prisma.enrollment.findUnique({
          where: { userId_courseId: { userId: req.user.id, courseId: course.id } }
        })
      : null;
    const hasAccess = Boolean(enrollment?.isActive) || req.user?.role === 'ADMIN';

    const lessons = buildLessons({
      videos: course.videos,
      resources: course.resources,
      progressByVideo: await progressMap(req.user?.id, course.videos.map(video => video.id)),
      hasAccess,
      freePreviewFirstLesson: course.freePreviewFirstLesson
    });

    const lesson = lessons.find(item => item.id === req.params.lessonId);
    if (!lesson) throw notFound('Lesson not found.');
    if (lesson.isLocked) {
      throw forbidden(
        hasAccess
          ? 'Finish the previous lesson to unlock this one.'
          : 'Enrol in this course to watch this lesson.'
      );
    }

    const comments = await prisma.timestampComment.findMany({
      where: { videoId: lesson.id, parentId: null },
      orderBy: { timestamp: 'asc' },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        likes: { select: { userId: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
            likes: { select: { userId: true } }
          }
        }
      }
    });

    res.json({
      course: { id: course.id, slug: course.slug, title: course.title },
      lesson,
      lessons: lessons.map(({ videoUrl: _videoUrl, descriptionHtml: _html, ...rest }) => rest),
      progress: courseProgress(lessons),
      comments: comments.map(comment => shapeComment(comment, req.user?.id))
    });
  })
);

coursesRouter.post(
  '/progress',
  requireUser,
  route(async (req, res) => {
    const data = parse(
      z.object({
        videoId: z.string().min(1),
        progressPercent: z.number().int().min(0).max(100),
        isCompleted: z.boolean().optional()
      }),
      req.body
    );

    const video = await prisma.video.findUnique({
      where: { id: data.videoId },
      select: { id: true, courseId: true, order: true }
    });
    if (!video) throw notFound('Lesson not found.');

    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: req.user!.id, courseId: video.courseId } }
    });
    if (!enrollment?.isActive && req.user!.role !== 'ADMIN') {
      throw forbidden('Activate this course before tracking progress.');
    }

    const earlier = await prisma.video.findMany({
      where: { courseId: video.courseId, order: { lt: video.order } },
      select: { id: true }
    });
    if (earlier.length > 0) {
      const completedEarlier = await prisma.videoProgress.count({
        where: {
          userId: req.user!.id,
          videoId: { in: earlier.map(item => item.id) },
          isCompleted: true
        }
      });
      if (completedEarlier < earlier.length) {
        throw forbidden('Finish the previous lesson first to unlock this one.');
      }
    }

    const isCompleted = Boolean(data.isCompleted || data.progressPercent >= 100);
    const progress = await prisma.videoProgress.upsert({
      where: { userId_videoId: { userId: req.user!.id, videoId: data.videoId } },
      create: {
        userId: req.user!.id,
        videoId: data.videoId,
        progressPercent: data.progressPercent,
        isCompleted
      },
      update: { progressPercent: data.progressPercent, isCompleted }
    });

    res.json({ progress });
  })
);

coursesRouter.post(
  '/license/activate',
  requireUser,
  route(async (req, res) => {
    const data = parse(
      z.object({ courseId: z.string().min(1), licenseCode: z.string().trim().min(4).max(20) }),
      req.body
    );

    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: req.user!.id, courseId: data.courseId } }
    });
    if (!enrollment?.licenseCode) throw badRequest('No license has been issued for this course yet.');
    if (enrollment.licenseExpiresAt && enrollment.licenseExpiresAt < new Date()) {
      throw badRequest('That license code has expired. Contact support for a new one.');
    }
    if (enrollment.licenseCode !== data.licenseCode.trim().toUpperCase()) {
      throw badRequest('That license code is not right.');
    }

    await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { isActive: true, activatedAt: new Date(), licenseCode: null, licenseExpiresAt: null }
    });

    res.json({ ok: true });
  })
);

coursesRouter.get(
  '/me/dashboard',
  requireUser,
  route(async (req, res) => {
    const enrollments = await prisma.enrollment.findMany({
      where: { userId: req.user!.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        course: {
          include: { videos: { select: { id: true, durationSec: true }, orderBy: { order: 'asc' } } }
        }
      }
    });

    const allVideoIds = enrollments.flatMap(row => row.course.videos.map(video => video.id));
    const progress = await progressMap(req.user!.id, allVideoIds);

    const courses = enrollments.map(enrollment => {
      const videos = enrollment.course.videos;
      const completed = videos.filter(video => progress.get(video.id)?.isCompleted).length;
      return {
        id: enrollment.course.id,
        slug: enrollment.course.slug,
        title: enrollment.course.title,
        thumbnailUrl: enrollment.course.thumbnailUrl,
        priceInr: enrollment.course.priceInr,
        lessonCount: videos.length,
        totalDurationSec: videos.reduce((sum, video) => sum + video.durationSec, 0),
        completedLessons: completed,
        percent: videos.length > 0 ? Math.round((completed / videos.length) * 100) : 0,
        isActive: enrollment.isActive,
        awaitingLicense: Boolean(!enrollment.isActive && enrollment.licenseCode),
        activatedAt: enrollment.activatedAt
      };
    });

    const [unreadNotifications, giftsPurchased] = await Promise.all([
      prisma.notification.count({ where: { userId: req.user!.id, isRead: false } }),
      prisma.giftCoupon.findMany({
        where: { purchaserId: req.user!.id },
        orderBy: { createdAt: 'desc' },
        include: { course: { select: { title: true, slug: true } } }
      })
    ]);

    res.json({ courses, unreadNotifications, gifts: giftsPurchased });
  })
);

coursesRouter.get(
  '/prompts/trending',
  route(async (_req, res) => {
    const prompts = await prisma.trendingPrompt.findMany({
      where: { isPublished: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: 24
    });
    res.json({ prompts });
  })
);

type CommentRow = {
  id: string;
  timestamp: number;
  text: string;
  createdAt: Date;
  userId: string;
  user: { id: string; name: string | null; email: string | null; image: string | null };
  likes: Array<{ userId: string }>;
  replies?: CommentRow[];
};

export function shapeComment(comment: CommentRow, viewerId?: string): unknown {
  return {
    id: comment.id,
    timestamp: comment.timestamp,
    text: comment.text,
    createdAt: comment.createdAt,
    author: {
      id: comment.user.id,
      name: comment.user.name ?? comment.user.email?.split('@')[0] ?? 'Student',
      image: comment.user.image
    },
    likeCount: comment.likes.length,
    likedByMe: viewerId ? comment.likes.some(like => like.userId === viewerId) : false,
    isMine: viewerId === comment.userId,
    replies: (comment.replies ?? []).map(reply => shapeComment(reply, viewerId))
  };
}
