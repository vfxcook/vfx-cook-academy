import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { PaymentStatus } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment_link?: {
      entity?: {
        id?: string;
        amount_paid?: number;
        currency?: string;
        status?: string;
        notes?: {
          userId?: string;
          courseId?: string;
          courseSlug?: string;
        };
      };
    };
    payment?: {
      entity?: {
        id?: string;
      };
    };
  };
};

function verifySignature(rawBody: string, signature: string, secret: string) {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

export async function POST(request: Request) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Missing RAZORPAY_WEBHOOK_SECRET" }, { status: 500 });
  }

  const signature = request.headers.get("x-razorpay-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();
  if (!verifySignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const data = JSON.parse(rawBody) as RazorpayWebhookPayload;
  if (data.event !== "payment_link.paid") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const paymentLink = data.payload?.payment_link?.entity;
  const notes = paymentLink?.notes;
  const userId = notes?.userId;
  const courseId = notes?.courseId;

  if (!userId || !courseId) {
    return NextResponse.json({ ok: true, ignored: true, reason: "missing notes" });
  }

  const paymentRef = data.payload?.payment?.entity?.id ?? paymentLink?.id ?? "razorpay-webhook";
  const amountInr = Math.round((paymentLink?.amount_paid ?? 0) / 100);

  await prisma.$transaction(async (tx) => {
    const pending = await tx.paymentRequest.findFirst({
      where: {
        userId,
        courseId,
        status: PaymentStatus.PENDING,
      },
      orderBy: { createdAt: "desc" },
    });

    if (pending) {
      await tx.paymentRequest.update({
        where: { id: pending.id },
        data: {
          status: PaymentStatus.APPROVED,
          reviewedAt: new Date(),
          reviewedBy: "razorpay-webhook",
          transactionRef: paymentRef,
          note: "Auto-approved from Razorpay webhook",
        },
      });
    } else {
      await tx.paymentRequest.create({
        data: {
          userId,
          courseId,
          amountInr,
          transactionRef: paymentRef,
          note: "Created from Razorpay webhook",
          status: PaymentStatus.APPROVED,
          reviewedAt: new Date(),
          reviewedBy: "razorpay-webhook",
        },
      });
    }

    await tx.enrollment.upsert({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
      create: {
        userId,
        courseId,
        isActive: true,
        activatedAt: new Date(),
      },
      update: {
        isActive: true,
        activatedAt: new Date(),
      },
    });
  });

  return NextResponse.json({ ok: true });
}
