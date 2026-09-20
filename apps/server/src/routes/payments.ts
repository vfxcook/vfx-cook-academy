import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../lib/auth.js';
import { env } from '../lib/env.js';
import { badRequest, conflict, notFound, parse, route } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { createOrder, razorpay, verifyCheckoutSignature } from '../lib/razorpay.js';
import { makeGiftCode } from '../lib/utils.js';

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

    if (!data.isGift) {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: req.user!.id, courseId: course.id } },
        select: { isActive: true }
      });
      if (enrollment?.isActive) throw conflict('You already have access to this course.');
    }

    const order = await createOrder({
      amountInr: course.priceInr,
      receipt: `rcpt_${req.user!.id.slice(-8)}_${Date.now()}`,
      notes: {
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
        note: data.isGift ? 'Razorpay order created for gift' : 'Razorpay order created',
        status: 'PENDING',
        isGift: Boolean(data.isGift)
      }
    });
    await ensurePendingEnrollment(req.user!.id, course.id);

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

    const result = await prisma.$transaction(async tx => {
      const pending = await tx.paymentRequest.findFirst({
        where: {
          userId: req.user!.id,
          courseId: data.courseId,
          transactionRef: data.razorpayOrderId,
          status: 'PENDING'
        },
        orderBy: { createdAt: 'desc' }
      });
      if (!pending) throw notFound('We could not find a pending payment for this course.');

      await tx.paymentRequest.update({
        where: { id: pending.id },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewedBy: 'razorpay-checkout',
          transactionRef: data.razorpayPaymentId,
          note: 'Verified through Razorpay Checkout'
        }
      });

      if (pending.isGift) {
        const coupon = await tx.giftCoupon.create({
          data: {
            code: makeGiftCode(),
            courseId: data.courseId,
            purchaserId: req.user!.id,
            amountInr: pending.amountInr,
            isRedeemed: false
          }
        });
        return { redirectTo: `/gift/${coupon.id}` };
      }

      await tx.enrollment.upsert({
        where: { userId_courseId: { userId: req.user!.id, courseId: data.courseId } },
        create: {
          userId: req.user!.id,
          courseId: data.courseId,
          isActive: true,
          activatedAt: new Date()
        },
        update: { isActive: true, activatedAt: new Date() }
      });
      return { redirectTo: '/dashboard' };
    });

    res.json({ ok: true, ...result });
  })
);

paymentsRouter.post(
  '/payment-link',
  requireUser,
  route(async (req, res) => {
    const { courseId } = parse(z.object({ courseId: z.string().min(1) }), req.body);
    const course = await loadPurchasableCourse(courseId);

    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: req.user!.id, courseId: course.id } },
      select: { isActive: true }
    });
    if (enrollment?.isActive) throw conflict('You already have access to this course.');

    const link = (await razorpay().paymentLink.create({
      amount: course.priceInr * 100,
      currency: 'INR',
      accept_partial: false,
      description: `${course.title} — VFX Cook Academy`,
      customer: {
        name: req.user!.name ?? undefined,
        email: req.user!.email ?? undefined,
        contact: req.user!.phone ?? undefined
      },
      notify: { sms: false, email: false },
      reminder_enable: false,
      callback_url: `${env.appUrl.replace(/\/$/, '')}/checkout/${course.slug}`,
      callback_method: 'get',
      notes: { userId: req.user!.id, courseId: course.id, courseSlug: course.slug }
    })) as unknown as { id: string; short_url: string };

    await prisma.paymentRequest.create({
      data: {
        userId: req.user!.id,
        courseId: course.id,
        amountInr: course.priceInr,
        transactionRef: link.id,
        note: 'Razorpay payment link generated',
        status: 'PENDING'
      }
    });
    await ensurePendingEnrollment(req.user!.id, course.id);

    res.json({ paymentUrl: link.short_url });
  })
);

paymentsRouter.post(
  '/requests',
  requireUser,
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

    const existing = await prisma.paymentRequest.findFirst({
      where: { userId: req.user!.id, courseId: course.id, status: 'PENDING' }
    });
    if (existing) throw conflict('You already have a payment under review for this course.');

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
      if (coupon.isRedeemed) throw conflict('That gift code has already been redeemed.');

      await tx.giftCoupon.update({
        where: { id: coupon.id },
        data: { isRedeemed: true, redeemerId: req.user!.id, redeemedAt: new Date() }
      });
      await tx.enrollment.upsert({
        where: { userId_courseId: { userId: req.user!.id, courseId: coupon.courseId } },
        create: {
          userId: req.user!.id,
          courseId: coupon.courseId,
          isActive: true,
          activatedAt: new Date()
        },
        update: { isActive: true, activatedAt: new Date() }
      });
      return coupon.course.slug;
    });

    res.json({ ok: true, redirectTo: `/learn/${slug}` });
  })
);

/**
 * Razorpay webhook. Mounted with a raw body parser and outside the CSRF check,
 * since the signature over the exact bytes is what authenticates it.
 */
export const razorpayWebhook = route(async (req, res) => {
  const signature = req.get('x-razorpay-signature');
  if (!signature) throw badRequest('Missing signature.');

  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body ?? '');
  const { verifyWebhookSignature } = await import('../lib/razorpay.js');
  if (!verifyWebhookSignature(rawBody, signature)) {
    return res.status(401).json({ error: 'Invalid signature.' });
  }

  const event = JSON.parse(rawBody) as {
    event?: string;
    payload?: {
      payment_link?: {
        entity?: {
          id?: string;
          amount_paid?: number;
          notes?: { userId?: string; courseId?: string };
        };
      };
      payment?: { entity?: { id?: string } };
    };
  };

  if (event.event !== 'payment_link.paid') return res.json({ ok: true, ignored: true });

  const link = event.payload?.payment_link?.entity;
  const userId = link?.notes?.userId;
  const courseId = link?.notes?.courseId;
  if (!userId || !courseId) return res.json({ ok: true, ignored: true, reason: 'missing notes' });

  const paymentRef = event.payload?.payment?.entity?.id ?? link?.id ?? 'razorpay-webhook';
  const amountInr = Math.round((link?.amount_paid ?? 0) / 100);

  await prisma.$transaction(async tx => {
    const pending = await tx.paymentRequest.findFirst({
      where: { userId, courseId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' }
    });

    if (pending) {
      await tx.paymentRequest.update({
        where: { id: pending.id },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewedBy: 'razorpay-webhook',
          transactionRef: paymentRef,
          note: 'Auto-approved from Razorpay webhook'
        }
      });
    } else {
      await tx.paymentRequest.create({
        data: {
          userId,
          courseId,
          amountInr,
          transactionRef: paymentRef,
          note: 'Created from Razorpay webhook',
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewedBy: 'razorpay-webhook'
        }
      });
    }

    if (pending?.isGift) {
      await tx.giftCoupon.create({
        data: {
          code: makeGiftCode(),
          courseId,
          purchaserId: userId,
          amountInr: amountInr || pending.amountInr,
          isRedeemed: false
        }
      });
    } else {
      await tx.enrollment.upsert({
        where: { userId_courseId: { userId, courseId } },
        create: { userId, courseId, isActive: true, activatedAt: new Date() },
        update: { isActive: true, activatedAt: new Date() }
      });
    }
  });

  return res.json({ ok: true });
});
