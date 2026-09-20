import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAdmin } from '../lib/auth.js';
import { badRequest, conflict, notFound, parse, route } from '../lib/http.js';
import { sendLicenseEmail } from '../lib/mailer.js';
import { prisma } from '../lib/prisma.js';
import { assertImage, assertVideo, saveUpload } from '../lib/storage.js';
import { makeLicenseCode, parseDateInput, slugify } from '../lib/utils.js';

export const adminRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 512 * 1024 * 1024 }
});

adminRouter.use(requireAdmin);

const LICENSE_VALID_DAYS = 7;

adminRouter.get(
  '/overview',
  route(async (_req, res) => {
    const [
      courses,
      publishedCount,
      lessonCount,
      activeStudents,
      pendingPayments,
      recentPayments,
      recentDoubts,
      completedProgress,
      resourceCount,
      studioCredits
    ] = await Promise.all([
      prisma.course.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { videos: true, enrollments: { where: { isActive: true } } } }
        }
      }),
      prisma.course.count({ where: { isPublished: true } }),
      prisma.video.count(),
      prisma.enrollment.findMany({ where: { isActive: true }, distinct: ['userId'], select: { userId: true } }),
      prisma.paymentRequest.count({ where: { status: 'PENDING' } }),
      prisma.paymentRequest.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: {
          user: { select: { name: true, email: true, phone: true } },
          course: { select: { title: true, priceInr: true } }
        }
      }),
      prisma.timestampComment.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: {
          user: { select: { name: true, email: true } },
          video: { select: { title: true, order: true, course: { select: { title: true, slug: true } } } }
        }
      }),
      prisma.videoProgress.count({ where: { isCompleted: true } }),
      prisma.courseResource.count(),
      prisma.studioCreditBalance.aggregate({ _sum: { availableCredits: true } })
    ]);

    const possibleProgress = Math.max(
      courses.reduce((sum, course) => sum + course._count.videos * course._count.enrollments, 0),
      1
    );
    const revenue = await prisma.paymentRequest.aggregate({
      where: { status: 'APPROVED' },
      _sum: { amountInr: true }
    });

    res.json({
      stats: {
        courses: courses.length,
        publishedCourses: publishedCount,
        lessons: lessonCount,
        resources: resourceCount,
        activeStudents: activeStudents.length,
        pendingPayments,
        completionRate: Math.round((completedProgress / possibleProgress) * 100),
        revenueInr: revenue._sum.amountInr ?? 0,
        studioCreditsOutstanding: studioCredits._sum.availableCredits ?? 0
      },
      courses: courses.map(course => ({
        id: course.id,
        slug: course.slug,
        title: course.title,
        priceInr: course.priceInr,
        isPublished: course.isPublished,
        thumbnailUrl: course.thumbnailUrl,
        lessonCount: course._count.videos,
        studentCount: course._count.enrollments
      })),
      recentPayments,
      recentDoubts
    });
  })
);

adminRouter.get(
  '/courses',
  route(async (_req, res) => {
    const courses = await prisma.course.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        videos: { orderBy: { order: 'asc' } },
        resources: true,
        _count: { select: { enrollments: { where: { isActive: true } } } }
      }
    });
    res.json({ courses });
  })
);

const courseSchema = z.object({
  slug: z.string().trim().min(2).max(120),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(2).max(5000),
  priceInr: z.coerce.number().int().min(1, 'Set a price above zero.'),
  isPublished: z.coerce.boolean().optional(),
  freePreviewFirstLesson: z.coerce.boolean().optional(),
  availableFrom: z.string().optional(),
  existingThumbnail: z.string().optional()
});

function readBool(value: unknown) {
  return value === true || value === 'true' || value === 'on' || value === '1';
}

adminRouter.post(
  '/courses',
  upload.single('thumbnailFile'),
  route(async (req, res) => {
    const data = parse(courseSchema, req.body);
    const slug = slugify(data.slug);
    if (!slug) throw badRequest('That slug is not usable.');

    const clash = await prisma.course.findUnique({ where: { slug } });
    if (clash) throw conflict('A course already uses that slug.');

    let thumbnailUrl: string | null = null;
    if (req.file) {
      assertImage(req.file, 5 * 1024 * 1024, 'Thumbnail');
      thumbnailUrl = await saveUpload(req.file, 'thumbnails');
    }

    const course = await prisma.course.create({
      data: {
        slug,
        title: data.title,
        description: data.description,
        priceInr: data.priceInr,
        isPublished: readBool(req.body.isPublished),
        freePreviewFirstLesson: readBool(req.body.freePreviewFirstLesson),
        availableFrom: parseDateInput(data.availableFrom),
        thumbnailUrl
      }
    });
    res.status(201).json({ course });
  })
);

adminRouter.patch(
  '/courses/:id',
  upload.single('thumbnailFile'),
  route(async (req, res) => {
    const data = parse(courseSchema, req.body);
    const slug = slugify(data.slug);
    if (!slug) throw badRequest('That slug is not usable.');

    const clash = await prisma.course.findFirst({ where: { slug, id: { not: req.params.id } } });
    if (clash) throw conflict('Another course already uses that slug.');

    let thumbnailUrl = data.existingThumbnail || null;
    if (req.file) {
      assertImage(req.file, 5 * 1024 * 1024, 'Thumbnail');
      thumbnailUrl = await saveUpload(req.file, 'thumbnails');
    }

    const course = await prisma.course.update({
      where: { id: req.params.id },
      data: {
        slug,
        title: data.title,
        description: data.description,
        priceInr: data.priceInr,
        isPublished: readBool(req.body.isPublished),
        freePreviewFirstLesson: readBool(req.body.freePreviewFirstLesson),
        availableFrom: parseDateInput(data.availableFrom),
        thumbnailUrl
      }
    });
    res.json({ course });
  })
);

adminRouter.post(
  '/courses/:id/publish',
  route(async (req, res) => {
    const { isPublished } = parse(z.object({ isPublished: z.boolean() }), req.body);
    const course = await prisma.course.update({
      where: { id: req.params.id },
      data: { isPublished }
    });
    res.json({ course });
  })
);

adminRouter.delete(
  '/courses/:id',
  route(async (req, res) => {
    await prisma.courseResource.deleteMany({ where: { courseId: req.params.id } });
    await prisma.course.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  })
);

const lessonSchema = z.object({
  courseId: z.string().min(1),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(8000).optional().or(z.literal('')),
  order: z.coerce.number().int().min(1),
  durationSec: z.coerce.number().int().min(0).optional(),
  videoUrl: z.string().trim().optional().or(z.literal('')),
  existingVideoUrl: z.string().trim().optional().or(z.literal(''))
});

adminRouter.get(
  '/lessons',
  route(async (_req, res) => {
    const [courses, resources] = await Promise.all([
      prisma.course.findMany({
        orderBy: { createdAt: 'desc' },
        include: { videos: { orderBy: { order: 'asc' } } }
      }),
      prisma.courseResource.findMany({ orderBy: { createdAt: 'desc' } })
    ]);

    res.json({
      courses: courses.map(course => ({
        id: course.id,
        slug: course.slug,
        title: course.title,
        lessons: course.videos
      })),
      resources
    });
  })
);

adminRouter.post(
  '/lessons',
  upload.single('videoFile'),
  route(async (req, res) => {
    const data = parse(lessonSchema, req.body);

    let videoUrl = data.videoUrl || '';
    if (req.file) {
      assertVideo(req.file);
      videoUrl = await saveUpload(req.file, 'videos');
    }
    if (!videoUrl) throw badRequest('Add a video URL or upload a file.');

    const lesson = await prisma.video.create({
      data: {
        courseId: data.courseId,
        title: data.title,
        description: data.description || null,
        videoUrl,
        order: data.order,
        durationSec: data.durationSec ?? 0
      }
    });

    const course = await prisma.course.findUnique({
      where: { id: data.courseId },
      select: { title: true }
    });
    const enrolled = await prisma.enrollment.findMany({
      where: { courseId: data.courseId, isActive: true },
      select: { userId: true }
    });
    if (enrolled.length > 0) {
      await prisma.notification.createMany({
        data: enrolled.map(row => ({
          userId: row.userId,
          actorUserId: req.user!.id,
          type: 'NEW_VIDEO_IN_ENROLLED_COURSE' as const,
          title: 'New lesson published',
          message: `${data.title} is now available in ${course?.title ?? 'your course'}.`,
          courseId: data.courseId,
          videoId: lesson.id
        }))
      });
    }

    res.status(201).json({ lesson });
  })
);

adminRouter.patch(
  '/lessons/:id',
  upload.single('videoFile'),
  route(async (req, res) => {
    const data = parse(lessonSchema, req.body);

    let videoUrl = data.videoUrl || data.existingVideoUrl || '';
    if (req.file) {
      assertVideo(req.file);
      videoUrl = await saveUpload(req.file, 'videos');
    }
    if (!videoUrl) throw badRequest('Add a video URL or upload a file.');

    const lesson = await prisma.video.update({
      where: { id: req.params.id },
      data: {
        title: data.title,
        description: data.description || null,
        order: data.order,
        durationSec: data.durationSec ?? 0,
        videoUrl
      }
    });
    res.json({ lesson });
  })
);

adminRouter.delete(
  '/lessons/:id',
  route(async (req, res) => {
    await prisma.video.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  })
);

adminRouter.post(
  '/resources',
  upload.single('resourceFile'),
  route(async (req, res) => {
    const data = parse(
      z.object({
        courseId: z.string().min(1),
        videoId: z.string().min(1),
        title: z.string().trim().min(2).max(160),
        description: z.string().trim().max(1000).optional().or(z.literal('')),
        fileUrl: z.string().trim().optional().or(z.literal('')),
        fileType: z.string().trim().min(1).max(40)
      }),
      req.body
    );

    const lesson = await prisma.video.findUnique({
      where: { id: data.videoId },
      select: { courseId: true }
    });
    if (!lesson || lesson.courseId !== data.courseId) {
      throw badRequest('That lesson does not belong to this course.');
    }

    let fileUrl = data.fileUrl || '';
    if (req.file) fileUrl = await saveUpload(req.file, 'resources');
    if (!fileUrl) throw badRequest('Upload a file or paste a link.');

    const resource = await prisma.courseResource.create({
      data: {
        courseId: data.courseId,
        videoId: data.videoId,
        title: data.title,
        description: data.description || null,
        fileUrl,
        fileType: data.fileType.toLowerCase()
      }
    });
    res.status(201).json({ resource });
  })
);

adminRouter.delete(
  '/resources/:id',
  route(async (req, res) => {
    await prisma.courseResource.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  })
);

adminRouter.get(
  '/students',
  route(async (_req, res) => {
    const students = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        enrollments: {
          orderBy: { updatedAt: 'desc' },
          include: {
            course: { select: { id: true, title: true, slug: true, videos: { select: { id: true } } } }
          }
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          include: { course: { select: { title: true } } }
        },
        videoProgress: {
          where: { isCompleted: true },
          select: { updatedAt: true, video: { select: { courseId: true } } }
        },
        studioCreditBalance: { select: { availableCredits: true } }
      }
    });

    res.json({
      students: students.map(student => ({
        id: student.id,
        name: student.name ?? 'Unnamed student',
        email: student.email ?? 'No email',
        phone: student.phone ?? null,
        role: student.role,
        joinedAt: student.createdAt,
        studioCredits: student.studioCreditBalance?.availableCredits ?? 0,
        latestPayment: student.payments[0] ?? null,
        lastActivity: [
          student.updatedAt,
          ...student.enrollments.map(e => e.updatedAt),
          ...student.payments.map(p => p.updatedAt),
          ...student.videoProgress.map(p => p.updatedAt)
        ].sort((a, b) => b.getTime() - a.getTime())[0],
        courses: student.enrollments.map(enrollment => {
          const total = enrollment.course.videos.length;
          const completed = student.videoProgress.filter(
            progress => progress.video.courseId === enrollment.courseId
          ).length;
          return {
            id: enrollment.course.id,
            title: enrollment.course.title,
            slug: enrollment.course.slug,
            isActive: enrollment.isActive,
            awaitingLicense: Boolean(!enrollment.isActive && enrollment.licenseCode),
            percent: total > 0 ? Math.round((completed / total) * 100) : 0
          };
        })
      }))
    });
  })
);

adminRouter.post(
  '/students/:id/grant',
  route(async (req, res) => {
    const { courseId } = parse(z.object({ courseId: z.string().min(1) }), req.body);
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: req.params.id, courseId } },
      create: { userId: req.params.id, courseId, isActive: true, activatedAt: new Date() },
      update: { isActive: true, activatedAt: new Date(), licenseCode: null, licenseExpiresAt: null }
    });
    res.json({ ok: true });
  })
);

adminRouter.post(
  '/students/:id/revoke',
  route(async (req, res) => {
    const { courseId } = parse(z.object({ courseId: z.string().min(1) }), req.body);
    await prisma.enrollment.updateMany({
      where: { userId: req.params.id, courseId },
      data: { isActive: false, activatedAt: null }
    });
    res.json({ ok: true });
  })
);

adminRouter.get(
  '/payments',
  route(async (_req, res) => {
    const payments = await prisma.paymentRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        course: { select: { title: true, slug: true, priceInr: true } }
      }
    });
    res.json({ payments });
  })
);

adminRouter.post(
  '/payments/:id/approve',
  route(async (req, res) => {
    const payment = await prisma.paymentRequest.findUnique({
      where: { id: req.params.id },
      include: { user: true, course: true }
    });
    if (!payment) throw notFound('Payment request not found.');
    if (payment.status !== 'PENDING') throw conflict('That request has already been reviewed.');

    const licenseCode = makeLicenseCode();
    const licenseExpiresAt = new Date(Date.now() + LICENSE_VALID_DAYS * 864e5);

    await prisma.$transaction([
      prisma.paymentRequest.update({
        where: { id: payment.id },
        data: { status: 'APPROVED', reviewedAt: new Date(), reviewedBy: req.user!.email ?? 'admin' }
      }),
      prisma.enrollment.upsert({
        where: { userId_courseId: { userId: payment.userId, courseId: payment.courseId } },
        create: {
          userId: payment.userId,
          courseId: payment.courseId,
          isActive: false,
          licenseCode,
          licenseExpiresAt
        },
        update: { isActive: false, licenseCode, licenseExpiresAt }
      })
    ]);

    let emailed = false;
    if (payment.user.email) {
      emailed = await sendLicenseEmail({
        to: payment.user.email,
        courseTitle: payment.course.title,
        licenseCode
      });
    }

    res.json({ ok: true, licenseCode, emailed });
  })
);

adminRouter.post(
  '/payments/:id/reject',
  route(async (req, res) => {
    const payment = await prisma.paymentRequest.findUnique({ where: { id: req.params.id } });
    if (!payment) throw notFound('Payment request not found.');
    if (payment.status !== 'PENDING') throw conflict('That request has already been reviewed.');

    await prisma.paymentRequest.update({
      where: { id: payment.id },
      data: { status: 'REJECTED', reviewedAt: new Date(), reviewedBy: req.user!.email ?? 'admin' }
    });
    res.json({ ok: true });
  })
);

adminRouter.get(
  '/prompts',
  route(async (_req, res) => {
    const prompts = await prisma.trendingPrompt.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }]
    });
    res.json({ prompts });
  })
);

adminRouter.post(
  '/prompts',
  upload.single('imageFile'),
  route(async (req, res) => {
    const data = parse(
      z.object({
        title: z.string().trim().min(2).max(160),
        prompt: z.string().trim().min(8, 'Write the full prompt.').max(5000),
        sortOrder: z.coerce.number().int().min(1).optional()
      }),
      req.body
    );
    if (!req.file) throw badRequest('A reference image is required.');
    assertImage(req.file, 5 * 1024 * 1024, 'Prompt image');

    const prompt = await prisma.trendingPrompt.create({
      data: {
        title: data.title,
        prompt: data.prompt,
        imageUrl: await saveUpload(req.file, 'prompts'),
        isPublished: readBool(req.body.isPublished),
        sortOrder: data.sortOrder ?? 1
      }
    });
    res.status(201).json({ prompt });
  })
);

adminRouter.patch(
  '/prompts/:id',
  route(async (req, res) => {
    const { isPublished } = parse(z.object({ isPublished: z.boolean() }), req.body);
    const prompt = await prisma.trendingPrompt.update({
      where: { id: req.params.id },
      data: { isPublished }
    });
    res.json({ prompt });
  })
);

adminRouter.delete(
  '/prompts/:id',
  route(async (req, res) => {
    await prisma.trendingPrompt.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  })
);

adminRouter.get(
  '/community',
  route(async (_req, res) => {
    const [doubts, posts] = await Promise.all([
      prisma.timestampComment.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          user: { select: { name: true, email: true } },
          video: {
            select: { title: true, order: true, course: { select: { title: true, slug: true } } }
          }
        }
      }),
      prisma.communityPost.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          user: { select: { name: true, email: true, image: true } },
          course: { select: { title: true, slug: true } },
          _count: { select: { comments: true, reactions: true } }
        }
      })
    ]);
    res.json({ doubts, posts });
  })
);

adminRouter.get(
  '/studio',
  route(async (_req, res) => {
    const [settings, packs, models, purchases, generations] = await Promise.all([
      prisma.appSetting.findMany(),
      prisma.studioCreditPack.findMany({ orderBy: { sortOrder: 'asc' } }),
      prisma.studioModelPricing.findMany({ orderBy: { sortOrder: 'asc' } }),
      prisma.studioCreditPurchase.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { user: { select: { name: true, email: true } }, pack: { select: { name: true } } }
      }),
      prisma.studioGeneration.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          user: { select: { name: true, email: true } },
          modelPricing: { select: { displayName: true } }
        }
      })
    ]);

    res.json({
      // The provider key is never echoed back; only whether one is stored.
      settings: settings.map(setting => ({
        key: setting.key,
        hasValue: Boolean(setting.value),
        updatedAt: setting.updatedAt
      })),
      packs,
      models,
      purchases,
      generations
    });
  })
);

adminRouter.post(
  '/studio/settings',
  route(async (req, res) => {
    const { key, value } = parse(
      z.object({ key: z.string().trim().min(1).max(80), value: z.string().max(500) }),
      req.body
    );
    await prisma.appSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    });
    res.json({ ok: true });
  })
);

adminRouter.post(
  '/studio/credits',
  route(async (req, res) => {
    const data = parse(
      z.object({
        email: z.string().trim().toLowerCase().email(),
        credits: z.coerce.number().int().refine(value => value !== 0, 'Enter a non-zero amount.'),
        note: z.string().trim().max(250).optional()
      }),
      req.body
    );

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) throw notFound('No account uses that email.');

    const balanceAfter = await prisma.$transaction(async tx => {
      const current = await tx.studioCreditBalance.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id }
      });
      const next = current.availableCredits + data.credits;

      await tx.studioCreditBalance.update({
        where: { userId: user.id },
        data: {
          availableCredits: next,
          ...(data.credits > 0
            ? { lifetimePurchasedCredits: { increment: data.credits } }
            : { lifetimeUsedCredits: { increment: Math.abs(data.credits) } })
        }
      });
      await tx.studioCreditLedger.create({
        data: {
          userId: user.id,
          type: 'ADMIN_ADJUSTMENT',
          deltaCredits: data.credits,
          balanceAfter: next,
          note: data.note || `Adjusted by ${req.user!.email ?? 'admin'}`
        }
      });
      return next;
    });

    res.json({ ok: true, balance: balanceAfter });
  })
);
