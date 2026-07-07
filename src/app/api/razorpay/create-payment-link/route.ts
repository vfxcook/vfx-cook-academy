import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type CreatePaymentLinkPayload = {
  amount: number;
  currency: "INR";
  accept_partial: boolean;
  description: string;
  customer: {
    name?: string | null;
    email?: string | null;
    contact?: string | null;
  };
  notify: {
    sms: boolean;
    email: boolean;
  };
  reminder_enable: boolean;
  callback_url: string;
  callback_method: "get";
  notes: {
    userId: string;
    courseId: string;
    courseSlug: string;
  };
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const appUrl = process.env.NEXTAUTH_URL;

  if (!keyId || !keySecret || !appUrl) {
    return NextResponse.json(
      {
        error:
          "Razorpay is not configured. Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and NEXTAUTH_URL.",
      },
      { status: 500 },
    );
  }

  const body = (await request.json()) as { courseId?: string };
  if (!body.courseId) {
    return NextResponse.json({ error: "courseId is required." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, phone: true },
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

  const payload: CreatePaymentLinkPayload = {
    amount: course.priceInr * 100,
    currency: "INR",
    accept_partial: false,
    description: `${course.title} - VFX Cook Academy`,
    customer: {
      name: user.name,
      email: user.email,
      contact: user.phone,
    },
    notify: {
      sms: false,
      email: false,
    },
    reminder_enable: false,
    callback_url: `${appUrl}/checkout/${course.slug}`,
    callback_method: "get",
    notes: {
      userId: user.id,
      courseId: course.id,
      courseSlug: course.slug,
    },
  };

  const authorization = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const razorpayResponse = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: {
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const razorpayJson = (await razorpayResponse.json()) as {
    id?: string;
    short_url?: string;
    error?: { description?: string };
  };
  if (!razorpayResponse.ok || !razorpayJson.short_url || !razorpayJson.id) {
    return NextResponse.json(
      {
        error: razorpayJson.error?.description ?? "Could not create Razorpay payment link.",
      },
      { status: 502 },
    );
  }

  await prisma.paymentRequest.create({
    data: {
      userId: user.id,
      courseId: course.id,
      amountInr: course.priceInr,
      transactionRef: razorpayJson.id,
      note: "Razorpay payment link generated",
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

  return NextResponse.json({ paymentUrl: razorpayJson.short_url });
}
