import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../lib/auth.js';
import { env } from '../lib/env.js';
import { badRequest, conflict, notFound, parse, route } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { rateLimit } from '../lib/rateLimit.js';
import { createOrder, verifyCheckoutSignature, verifyWebhookSignature } from '../lib/razorpay.js';
import { manualTransfersOnly, settleCoursePayment, settleStudioPurchase } from '../lib/settle.js';

export const paymentsRouter = Router();

paymentsRouter.get('/config', (_req, res) => {
  res.json({
    razorpayEnabled: env.razorpay.enabled,
    razorpayKeyId: env.razorpay.enabled ? env.razorpay.keyId : null,
    qrCodeUrl: env.qrCodeUrl || null
  });
});

async function loadPurchasableCourse(courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, slug: true, title: true, priceInr: true, isPublished: true }
  });
  if (!course || !course.isPublished) throw notFound('Course not found.');
  return course;
}

async function assertNotAlreadyEnrolled(userId: string, courseId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { isActive: true }
  });
  if (enrollment?.isActive) throw conflict('You already have access to this course.');
}

/** Makes the course show up on the dashboard while a manual transfer is reviewed. */
async function ensurePendingEnrollment(userId: string, courseId: string) {
  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId, courseId } },
    create: { userId, courseId, isActive: false },
    update: {}
  });
}

paymentsRouter.post(
  '/order',
  requireUser,
  route(async (req, res) => {
    const data = parse(
      z.object({ courseId: z.string().min(1), isGift: z.boolean().optional() }),
      req.body
    );
    const course = await loadPurchasableCourse(data.courseId);
    if (!data.isGift) await assertNotAlreadyEnrolled(req.user!.id, course.id);

    const order = await createOrder({
      amountInr: course.priceInr,
      receipt: `rcpt_${req.user!.id.slice(-8)}_${Date.now()}`,
      notes: {
        kind: 'course_purchase',
        userId: req.user!.id,
        courseId: course.id,
        courseSlug: course.slug,
        isGift: data.isGift ? 'true' : 'false'
      }
    });

    await prisma.paymentRequest.create({
      data: {
        userId: req.user!.id,
        courseId: course.id,
        amountInr: course.priceInr,
        transactionRef: order.id,
        note: data.isGift ? 'Razorpay checkout opened for a gift' : 'Razorpay checkout opened',
        status: 'PENDING',
        isGift: Boolean(data.isGift)
      }
    });

    res.json({
      orderId: order.id,
      amount: Number(order.amount),
      currency: order.currency,
      keyId: env.razorpay.keyId,
      courseTitle: course.title
    });
  })
);

paymentsRouter.post(
  '/verify',
  requireUser,
  route(async (req, res) => {
    const data = parse(
      z.object({
        courseId: z.string().min(1),
        razorpayOrderId: z.string().min(1),
        razorpayPaymentId: z.string().min(1),
        razorpaySignature: z.string().min(1)
      }),
      req.body
    );

    if (!verifyCheckoutSignature(data.razorpayOrderId, data.razorpayPaymentId, data.razorpaySignature)) {
      throw badRequest('We could not verify that payment signature.');
    }

    const course = await prisma.course.findUnique({
      where: { id: data.courseId },
      select: { slug: true }
    });
    if (!course) throw notFound('Course not found.');

    const redirectTo = await prisma.$transaction(async tx => {
      // Either id may be on the row: the order id before settling, the payment id after.
      const request = await tx.paymentRequest.findFirst({
        where: {
          userId: req.user!.id,
          courseId: data.courseId,
          transactionRef: { in: [data.razorpayOrderId, data.razorpayPaymentId] }
        },
        orderBy: { createdAt: 'desc' }
      });
      if (!request) throw notFound('We could not find that checkout. Contact support with your payment id.');

      const outcome = await settleCoursePayment(tx, {
        requestId: request.id,
        paymentRef: data.razorpayPaymentId,
        reviewer: 'razorpay-checkout',
        note: 'Verified through Razorpay Checkout'
      });

      if (!request.isGift) return `/learn/${course.slug}`;
      if (outcome.giftId) return `/gift/${outcome.giftId}`;

      // The webhook settled this gift first; send the buyer to the coupon it minted.
      const coupon = await tx.giftCoupon.findFirst({
        where: { purchaserId: req.user!.id, courseId: data.courseId, createdAt: { gte: request.createdAt } },
        orderBy: { createdAt: 'desc' },
        select: { id: true }
      });
      return coupon ? `/gift/${coupon.id}` : '/dashboard';
    });

    res.json({ ok: true, redirectTo });
  })
);

paymentsRouter.post(
  '/requests',
  requireUser,
  rateLimit({ name: 'manual-payment', windowMs: 60 * 60_000, max: 10 }),
  route(async (req, res) => {
    const data = parse(
      z.object({
        courseId: z.string().min(1),
        transactionRef: z.string().trim().min(4, 'Enter the UTR or reference id.').max(100),
        note: z.string().trim().max(250).optional()
      }),
      req.body
    );
    const course = await loadPurchasableCourse(data.courseId);
    await assertNotAlreadyEnrolled(req.user!.id, course.id);

    // An abandoned online checkout must not block the manual fallback.
    const existing = await prisma.paymentRequest.findFirst({
      where: { userId: req.user!.id, courseId: course.id, status: 'PENDING', ...manualTransfersOnly }
    });
    if (existing) throw conflict('You already have a transfer under review for this course.');

    const paymentRequest = await prisma.paymentRequest.create({
      data: {
        userId: req.user!.id,
        courseId: course.id,
        amountInr: course.priceInr,
        transactionRef: data.transactionRef,
        note: data.note,
        status: 'PENDING'
      }
    });
    await ensurePendingEnrollment(req.user!.id, course.id);

    res.status(201).json({ paymentRequest });
  })
);

paymentsRouter.get(
  '/gifts/:id',
  requireUser,
  route(async (req, res) => {
    const gift = await prisma.giftCoupon.findUnique({
      where: { id: req.params.id },
      include: { course: { select: { title: true, slug: true, thumbnailUrl: true } } }
    });
    if (!gift || gift.purchaserId !== req.user!.id) throw notFound('Gift not found.');

    res.json({
      gift: {
        id: gift.id,
        code: gift.code,
        amountInr: gift.amountInr,
        isRedeemed: gift.isRedeemed,
        redeemedAt: gift.redeemedAt,
        createdAt: gift.createdAt,
        course: gift.course,
        redeemUrl: `${env.appUrl.replace(/\/$/, '')}/gift/redeem?code=${gift.code}`
      }
    });
  })
);

paymentsRouter.post(
  '/gifts/redeem',
  requireUser,
  rateLimit({ name: 'gift-redeem', windowMs: 15 * 60_000, max: 10 }),
  route(async (req, res) => {
    const { code } = parse(
      z.object({ code: z.string().trim().min(6, 'Enter the full gift code.').max(64) }),
      req.body
    );

    const slug = await prisma.$transaction(async tx => {
      const coupon = await tx.giftCoupon.findUnique({
        where: { code: code.toUpperCase() },
        include: { course: { select: { slug: true } } }
      });
      if (!coupon) throw badRequest('That gift code is not valid.');

      // Conditional flip, so one code can only ever be redeemed once.
      const claimed = await tx.giftCoupon.updateMany({
        where: { id: coupon.id, isRedeemed: false },
        data: { isRedeemed: true, redeemerId: req.user!.id, redeemedAt: new Date() }
      });
      if (claimed.count === 0) throw conflict('That gift code has already been redeemed.');

      await tx.enrollment.upsert({
        where: { userId_courseId: { userId: req.user!.id, courseId: coupon.courseId } },
        create: {
          userId: req.user!.id,
          courseId: coupon.courseId,
          isActive: true,
          activatedAt: new Date()
        },
        update: { isActive: true, activatedAt: new Date(), licenseCode: null, licenseExpiresAt: null }
      });
      return coupon.course.slug;
    });

    res.json({ ok: true, redirectTo: `/learn/${slug}` });
  })
);

type WebhookEvent = {
  event?: string;
  payload?: {
    order?: { entity?: { id?: string; notes?: Record<string, string> } };
    payment?: { entity?: { id?: string } };
    payment_link?: {
      entity?: { id?: string; amount_paid?: number; notes?: { userId?: string; courseId?: string } };
    };
  };
};

/**
 * Razorpay webhook. Mounted with a raw body parser and outside the CSRF check, since the
 * signature over the exact bytes is what authenticates it. Subscribe to `order.paid` and
 * `payment_link.paid`: the first catches students who paid but closed the tab before
 * Checkout could report back, which would otherwise leave them charged and locked out.
 */
export const razorpayWebhook = route(async (req, res) => {
  const signature = req.get('x-razorpay-signature');
  if (!signature) throw badRequest('Missing signature.');

  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  if (!verifyWebhookSignature(rawBody, signature)) {
    return res.status(401).json({ error: 'Invalid signature.' });
  }

  const event = JSON.parse(rawBody) as WebhookEvent;
  const paymentId = event.payload?.payment?.entity?.id;

  if (event.event === 'order.paid') {
    const order = event.payload?.order?.entity;
    if (!order?.id || !paymentId) return res.json({ ok: true, ignored: true });

    if (order.notes?.kind === 'studio_credit_purchase') {
      await prisma.$transaction(tx => settleStudioPurchase(tx, { orderId: order.id!, paymentId }));
      return res.json({ ok: true });
    }

    await prisma.$transaction(async tx => {
      const request = await tx.paymentRequest.findFirst({
        where: { transactionRef: { in: [order.id!, paymentId] } }
      });
      if (!request) return;
      await settleCoursePayment(tx, {
        requestId: request.id,
        paymentRef: paymentId,
        reviewer: 'razorpay-webhook',
        note: 'Settled by the Razorpay order.paid webhook'
      });
    });
    return res.json({ ok: true });
  }

  if (event.event === 'payment_link.paid') {
    const link = event.payload?.payment_link?.entity;
    const userId = link?.notes?.userId;
    const courseId = link?.notes?.courseId;
    if (!link?.id || !userId || !courseId) return res.json({ ok: true, ignored: true });

    const paymentRef = paymentId ?? link.id;

    await prisma.$transaction(async tx => {
      const request = await tx.paymentRequest.findFirst({
        where: { transactionRef: { in: [link.id!, paymentRef] } }
      });

      if (request) {
        await settleCoursePayment(tx, {
          requestId: request.id,
          paymentRef,
          reviewer: 'razorpay-webhook',
          note: 'Settled by the Razorpay payment_link.paid webhook'
        });
        return;
      }

      // A link paid that this app never recorded: keep the money and the access in step.
      await tx.paymentRequest.create({
        data: {
          userId,
          courseId,
          amountInr: Math.round((link.amount_paid ?? 0) / 100),
          transactionRef: paymentRef,
          note: 'Created from the Razorpay payment_link.paid webhook',
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewedBy: 'razorpay-webhook'
        }
      });
      await tx.enrollment.upsert({
        where: { userId_courseId: { userId, courseId } },
        create: { userId, courseId, isActive: true, activatedAt: new Date() },
        update: { isActive: true, activatedAt: new Date() }
      });
    });
    return res.json({ ok: true });
  }

  return res.json({ ok: true, ignored: true });
});
