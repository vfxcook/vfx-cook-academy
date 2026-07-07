import { NextResponse } from "next/server";
import { PaymentStatus } from "@prisma/client";
import { z } from "zod";

import { isAdminSession } from "@/lib/admin";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const paymentSchema = z.object({
  courseId: z.string().min(1),
  amountInr: z.number().int().min(1),
  transactionRef: z.string().min(4).max(100),
  note: z.string().max(250).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = paymentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { courseId, amountInr, transactionRef, note } = parsed.data;

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course || !course.isPublished) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const existing = await prisma.paymentRequest.findFirst({
    where: {
      userId: session.user.id,
      courseId,
      status: PaymentStatus.PENDING,
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "You already have a pending payment request for this course." },
      { status: 400 },
    );
  }

  const requestRow = await prisma.paymentRequest.create({
    data: {
      userId: session.user.id,
      courseId,
      amountInr,
      transactionRef,
      note,
      status: PaymentStatus.PENDING,
    },
  });

  await prisma.enrollment.upsert({
    where: {
      userId_courseId: {
        userId: session.user.id,
        courseId,
      },
    },
    create: {
      userId: session.user.id,
      courseId,
      isActive: false,
    },
    update: {},
  });

  return NextResponse.json({ paymentRequest: requestRow });
}

export async function GET() {
  const isAdmin = await isAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requests = await prisma.paymentRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { name: true, email: true, phone: true },
      },
      course: {
        select: { title: true, slug: true, priceInr: true },
      },
    },
  });

  return NextResponse.json({ requests });
}
