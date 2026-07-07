import { PaymentStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { isAdminSession } from "@/lib/admin";
import { sendLicenseEmail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { makeLicenseCode } from "@/lib/utils";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const isAdmin = await isAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = await context.params;

  const payment = await prisma.paymentRequest.findUnique({
    where: { id: params.id },
    include: {
      user: true,
      course: true,
    },
  });

  if (!payment) {
    return NextResponse.json({ error: "Payment request not found" }, { status: 404 });
  }

  if (payment.status !== PaymentStatus.PENDING) {
    return NextResponse.json({ error: "Payment request already reviewed" }, { status: 400 });
  }

  const licenseCode = makeLicenseCode();

  await prisma.$transaction([
    prisma.paymentRequest.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.APPROVED,
        reviewedAt: new Date(),
        reviewedBy: "admin",
      },
    }),
    prisma.enrollment.upsert({
      where: {
        userId_courseId: {
          userId: payment.userId,
          courseId: payment.courseId,
        },
      },
      create: {
        userId: payment.userId,
        courseId: payment.courseId,
        isActive: false,
        licenseCode,
        licenseExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      },
      update: {
        isActive: false,
        licenseCode,
        licenseExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      },
    }),
  ]);

  if (payment.user.email) {
    await sendLicenseEmail({
      to: payment.user.email,
      courseTitle: payment.course.title,
      licenseCode,
    });
  }

  return NextResponse.json({ ok: true, licenseCode });
}
