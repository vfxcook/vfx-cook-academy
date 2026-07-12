import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GiftSuccessClient } from "@/components/GiftSuccessClient";

export default async function GiftSuccessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const coupon = await prisma.giftCoupon.findUnique({
    where: { id },
    include: {
      course: true,
      purchaser: { select: { name: true, email: true } },
    },
  });

  if (!coupon) {
    notFound();
  }

  if (coupon.purchaserId !== session.user.id && session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return <GiftSuccessClient coupon={coupon} />;
}
