import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { PaymentStatus } from "@/generated/prisma";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type VerifyPaymentBody = {
  courseId?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return NextResponse.json({ error: "Missing RAZORPAY_KEY_SECRET." }, { status: 500 });
  }

  const body = (await request.json()) as VerifyPaymentBody;
  const courseId = body.courseId?.trim();
  const orderId = body.razorpay_order_id?.trim();
  const paymentId = body.razorpay_payment_id?.trim();
  const signature = body.razorpay_signature?.trim();
  if (!courseId || !orderId || !paymentId || !signature) {
    return NextResponse.json({ error: "Missing required payment fields." }, { status: 400 });
  }

  const generatedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  if (generatedSignature !== signature) {
    return NextResponse.json({ error: "Signature verification failed." }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const pending = await tx.paymentRequest.findFirst({
        where: {
          userId: session.user.id,
          courseId,
          transactionRef: orderId,
          status: PaymentStatus.PENDING,
        },
        orderBy: { createdAt: "desc" },
      });

      if (!pending) {
        throw new Error("Payment request not found for this course or user.");
      }
      await tx.paymentRequest.update({
        where: { id: pending.id },
        data: {
          status: PaymentStatus.APPROVED,
          reviewedAt: new Date(),
          reviewedBy: "razorpay-standard-checkout",
          transactionRef: paymentId,
          note: "Payment verified via Razorpay Standard Checkout",
        },
      });

      await tx.enrollment.upsert({
        where: {
          userId_courseId: {
            userId: session.user.id,
            courseId,
          },
        },
        create: {
          userId: session.user.id,
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
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not verify payment." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
