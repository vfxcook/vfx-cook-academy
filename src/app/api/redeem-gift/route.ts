import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    const formData = await request.formData().catch(() => null);
    const courseId = formData?.get("courseId")?.toString();
    if (courseId) {
      const course = await prisma.course.findUnique({ where: { id: courseId }, select: { slug: true } });
      if (course?.slug) {
        return NextResponse.redirect(new URL(`/register?next=${encodeURIComponent(`/checkout/${course.slug}`)}`, request.url));
      }
    }
    return NextResponse.redirect(new URL("/register", request.url));
  }

  const formData = await request.formData();
  const code = formData.get("code")?.toString().trim();
  const courseId = formData.get("courseId")?.toString().trim();

  if (!code || !courseId) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { slug: true },
  });

  if (!course) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  try {
    await prisma.$transaction(async (tx) => {
      const coupon = await tx.giftCoupon.findUnique({
        where: { code },
      });

      if (!coupon || coupon.courseId !== courseId || coupon.isRedeemed) {
        throw new Error("invalid_coupon");
      }

      await tx.giftCoupon.update({
        where: { id: coupon.id },
        data: {
          isRedeemed: true,
          redeemerId: session.user.id,
          redeemedAt: new Date(),
        },
      });

      await tx.enrollment.upsert({
        where: {
          userId_courseId: {
            userId: session.user.id,
            courseId: courseId,
          },
        },
        create: {
          userId: session.user.id,
          courseId: courseId,
          isActive: true,
          activatedAt: new Date(),
        },
        update: {
          isActive: true,
          activatedAt: new Date(),
        },
      });
    });

    return NextResponse.redirect(new URL(`/course/${course.slug}`, request.url));
  } catch (error) {
    const isInvalid = error instanceof Error && error.message === "invalid_coupon";
    return NextResponse.redirect(new URL(`/checkout/${course.slug}?status=${isInvalid ? "invalid_coupon" : "error"}`, request.url));
  }
}
