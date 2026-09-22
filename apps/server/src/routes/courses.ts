import { Router } from 'express';
import { z } from 'zod';
import { requireUser, type SessionUser } from '../lib/auth.js';
import { badRequest, forbidden, notFound, parse, route } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { rateLimit } from '../lib/rateLimit.js';
import { buildLessons, courseProgress, toAuthor } from '../lib/serialize.js';
import { manualTransfersOnly } from '../lib/settle.js';

export const coursesRouter = Router();

const isAdmin = (user?: SessionUser) => user?.role === 'ADMIN';

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

async function hasCourseAccess(user: SessionUser | undefined, courseId: string) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
    select: { isActive: true }
  });
  return Boolean(enrollment?.isActive);
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
          isEnrolled: Boolean(enrollment?.isActive) || isAdmin(req.user),
          awaitingLicense: Boolean(enrollment && !enrollment.isActive && enrollment.licenseCode)
        };
      })
    });
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

coursesRouter.get(
  '/me/dashboard',
  requireUser,
  route(async (req, res) => {
    const user = req.user!;
    const include = {
      videos: { select: { id: true, durationSec: true }, orderBy: { order: 'asc' as const } }
    };

    // Admins get every course as if enrolled, without writing enrolment rows for them.
    const rows = isAdmin(user)
      ? (await prisma.course.findMany({ orderBy: { createdAt: 'desc' }, include })).map(course => ({
          course,
          isActive: true,
          licenseCode: null as string | null,
          activatedAt: null as Date | null
        }))
      : (
          await prisma.enrollment.findMany({
            where: { userId: user.id },
            orderBy: { updatedAt: 'desc' },
            include: { course: { include } }
          })
        ).map(row => ({
          course: row.course,
          isActive: row.isActive,
          licenseCode: row.licenseCode,
          activatedAt: row.activatedAt
        }));

    const progress = await progressMap(
      user.id,
      rows.flatMap(row => row.course.videos.map(video => video.id))
    );

    const underReview = new Set(
      (
        await prisma.paymentRequest.findMany({
          where: { userId: user.id, status: 'PENDING', ...manualTransfersOnly },
          select: { courseId: true }
        })
      ).map(row => row.courseId)
    );

    const courses = rows.map(row => {
      const videos = row.course.videos;
      const completed = videos.filter(video => progress.get(video.id)?.isCompleted).length;
      return {
        id: row.course.id,
        slug: row.course.slug,
        title: row.course.title,
        thumbnailUrl: row.course.thumbnailUrl,
        priceInr: row.course.priceInr,
        lessonCount: videos.length,
        totalDurationSec: videos.reduce((sum, video) => sum + video.durationSec, 0),
        completedLessons: completed,
        percent: videos.length > 0 ? Math.round((completed / videos.length) * 100) : 0,
        isActive: row.isActive,
        awaitingLicense: Boolean(!row.isActive && row.licenseCode),
        paymentUnderReview: !row.isActive && underReview.has(row.course.id),
        activatedAt: row.activatedAt
      };
    });

    const [unreadNotifications, gifts] = await Promise.all([
      prisma.notification.count({ where: { userId: user.id, isRead: false } }),
      prisma.giftCoupon.findMany({
        where: { purchaserId: user.id },
        orderBy: { createdAt: 'desc' },
        include: { course: { select: { title: true, slug: true } } }
      })
    ]);

    res.json({ courses, unreadNotifications, gifts });
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
    if (!course || (!course.isPublished && !isAdmin(req.user))) throw notFound('Course not found.');

    const enrollment = req.user
      ? await prisma.enrollment.findUnique({
          where: { userId_courseId: { userId: req.user.id, courseId: course.id } }
        })
      : null;

    const hasAccess = Boolean(enrollment?.isActive) || isAdmin(req.user);
    const lessons = buildLessons({
      videos: course.videos,
      resources: course.resources,
      progressByVideo: await progressMap(req.user?.id, course.videos.map(video => video.id)),
      hasAccess,
      freePreviewFirstLesson: course.freePreviewFirstLesson,
      unlockAll: isAdmin(req.user)
    });

    // Only a manual transfer is "under review"; an unpaid online checkout is not.
    const pendingPayment = req.user
      ? await prisma.paymentRequest.findFirst({
          where: { userId: req.user.id, courseId: course.id, status: 'PENDING', ...manualTransfersOnly },
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
  '/:slug/leaderboard',
  requireUser,
  route(async (req, res) => {
    const course = await prisma.course.findUnique({
      where: { slug: req.params.slug },
      select: { id: true, _count: { select: { videos: true } } }
    });
    if (!course) throw notFound('Course not found.');
    if (!(await hasCourseAccess(req.user, course.id))) {
      throw forbidden('Activate this course to see the leaderboard.');
    }

    const [members, completions, posts] = await Promise.all([
      prisma.enrollment.findMany({
        where: { courseId: course.id, isActive: true },
        select: { user: { select: { id: true, name: true, email: true, image: true } } }
      }),
      prisma.videoProgress.groupBy({
        by: ['userId'],
        where: { isCompleted: true, video: { courseId: course.id } },
        _count: { _all: true }
      }),
      prisma.communityPost.groupBy({
        by: ['userId'],
        where: { courseId: course.id },
        _count: { _all: true }
      })
    ]);

    const completed = new Map(completions.map(row => [row.userId, row._count._all]));
    const posted = new Map(posts.map(row => [row.userId, row._count._all]));
    const total = course._count.videos;

    const rows = members
      .map(({ user }) => {
        const completedLessons = completed.get(user.id) ?? 0;
        return {
          ...toAuthor(user),
          completedLessons,
          totalLessons: total,
          percent: total > 0 ? Math.round((completedLessons / total) * 100) : 0,
          posts: posted.get(user.id) ?? 0,
          isMe: user.id === req.user!.id
        };
      })
      .sort((a, b) => b.completedLessons - a.completedLessons || b.posts - a.posts);

    res.json({ rows: rows.slice(0, 20), myRank: rows.findIndex(row => row.isMe) + 1 || null });
  })
);

coursesRouter.get(
  '/:slug/lessons/:lessonId',
  route(async (req, res) => {
    const course = await prisma.course.findUnique({
      where: { slug: req.params.slug },
      include: { videos: { orderBy: { order: 'asc' } }, resources: true }
    });
    if (!course || (!course.isPublished && !isAdmin(req.user))) throw notFound('Course not found.');

    const hasAccess = await hasCourseAccess(req.user, course.id);
    const lessons = buildLessons({
      videos: course.videos,
      resources: course.resources,
      progressByVideo: await progressMap(req.user?.id, course.videos.map(video => video.id)),
      hasAccess,
      freePreviewFirstLesson: course.freePreviewFirstLesson,
      unlockAll: isAdmin(req.user)
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
      access: { hasAccess, isSignedIn: Boolean(req.user) },
      comments: comments.map(comment => shapeComment(comment, req.user))
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
    const user = req.user!;

    const video = await prisma.video.findUnique({
      where: { id: data.videoId },
      select: { id: true, courseId: true, order: true }
    });
    if (!video) throw notFound('Lesson not found.');
    if (!(await hasCourseAccess(user, video.courseId))) {
      throw forbidden('Activate this course before tracking progress.');
    }

    if (!isAdmin(user)) {
      const earlier = await prisma.video.findMany({
        where: { courseId: video.courseId, order: { lt: video.order } },
        select: { id: true }
      });
      if (earlier.length > 0) {
        const completedEarlier = await prisma.videoProgress.count({
          where: { userId: user.id, videoId: { in: earlier.map(item => item.id) }, isCompleted: true }
        });
        if (completedEarlier < earlier.length) {
          throw forbidden('Finish the previous lesson first to unlock this one.');
        }
      }
    }

    const existing = await prisma.videoProgress.findUnique({
      where: { userId_videoId: { userId: user.id, videoId: data.videoId } },
      select: { isCompleted: true, progressPercent: true }
    });

    // Rewatching a finished lesson from the start must not un-finish it.
    const isCompleted = Boolean(existing?.isCompleted || data.isCompleted || data.progressPercent >= 100);
    const progressPercent = Math.max(existing?.progressPercent ?? 0, data.progressPercent);

    const progress = await prisma.videoProgress.upsert({
      where: { userId_videoId: { userId: user.id, videoId: data.videoId } },
      create: { userId: user.id, videoId: data.videoId, progressPercent, isCompleted },
      update: { progressPercent, isCompleted }
    });

    res.json({ progress });
  })
);

coursesRouter.post(
  '/license/activate',
  requireUser,
  rateLimit({ name: 'license', windowMs: 15 * 60_000, max: 10 }),
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

export function shapeComment(comment: CommentRow, viewer?: SessionUser): unknown {
  return {
    id: comment.id,
    timestamp: comment.timestamp,
    text: comment.text,
    createdAt: comment.createdAt,
    author: toAuthor(comment.user),
    likeCount: comment.likes.length,
    likedByMe: viewer ? comment.likes.some(like => like.userId === viewer.id) : false,
    isMine: viewer?.id === comment.userId,
    // Admins moderate every thread, so they can remove any comment.
    canDelete: viewer ? viewer.id === comment.userId || viewer.role === 'ADMIN' : false,
    replies: (comment.replies ?? []).map(reply => shapeComment(reply, viewer))
  };
}
