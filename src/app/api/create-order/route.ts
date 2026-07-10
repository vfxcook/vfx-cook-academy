import Razorpay from "razorpay";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return NextResponse.json(
      { error: "Razorpay is not configured. Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET." },
      { status: 500 },
    );
  }

  const body = (await request.json()) as { courseId?: string };
  if (!body.courseId) {
    return NextResponse.json({ error: "courseId is required." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const course = await prisma.course.findUnique({
    where: { id: body.courseId },
    select: { id: true, slug: true, title: true, priceInr: true, isPublished: true },
  });
  if (!course || !course.isPublished) {
    return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }

  const alreadyEnrolled = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: user.id,
        courseId: course.id,
      },
    },
    select: { isActive: true },
  });
  if (alreadyEnrolled?.isActive) {
    return NextResponse.json({ error: "Course already active.", redirectTo: "/dashboard" }, { status: 400 });
  }

  const amount = course.priceInr * 100;
  if (amount < 100) {
    return NextResponse.json({ error: "Minimum amount is 100 paise." }, { status: 400 });
  }

  const razorpay = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  try {
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `rcpt_${user.id.slice(-8)}_${Date.now()}`,
      notes: {
        userId: user.id,
        courseId: course.id,
        courseSlug: course.slug,
      },
    });

    await prisma.paymentRequest.create({
      data: {
        userId: user.id,
        courseId: course.id,
        amountInr: course.priceInr,
        transactionRef: order.id,
        note: "Razorpay order created",
        status: "PENDING",
      },
    });

    await prisma.enrollment.upsert({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId: course.id,
        },
      },
      create: {
        userId: user.id,
        courseId: course.id,
        isActive: false,
      },
      update: {},
    });

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId,
    });
  } catch (error: unknown) {
    const maybeError = error as { statusCode?: number; error?: { description?: string }; message?: string };
    const status = maybeError.statusCode === 401 ? 401 : 500;
    return NextResponse.json(
      { error: maybeError.error?.description ?? maybeError.message ?? "Failed to create Razorpay order." },
      { status },
    );
  }
}
