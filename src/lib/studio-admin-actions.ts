"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function saveStudioSetting(formData: FormData) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

  const key = formData.get("key") as string;
  const value = formData.get("value") as string;

  if (!key) return;

  // @ts-ignore - Ignore type error during live dev if Prisma client isn't regenerated yet
  await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });

  revalidatePath("/admin/studio");
}

export async function manuallyAllocateCredits(formData: FormData) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");

  const email = formData.get("email") as string;
  const credits = parseInt(formData.get("credits") as string, 10);
  const note = formData.get("note") as string;

  if (!email || isNaN(credits) || credits === 0) return;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("User not found with this email");

  // Since we are allocating, we write a custom transaction to mark it as ADMIN_ADJUSTMENT
  await prisma.$transaction(async (tx) => {
    const current = await tx.studioCreditBalance.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });
    const nextBalance = current.availableCredits + credits;
    await tx.studioCreditBalance.update({
      where: { userId: user.id },
      data: {
        availableCredits: nextBalance,
        ...(credits > 0 ? { lifetimePurchasedCredits: { increment: credits } } : { lifetimeUsedCredits: { increment: Math.abs(credits) } })
      },
    });
    await tx.studioCreditLedger.create({
      data: {
        userId: user.id,
        type: "ADMIN_ADJUSTMENT",
        deltaCredits: credits,
        balanceAfter: nextBalance,
        note: note || `Admin adjustment by ${session.user.email}`,
      },
    });
  });

  revalidatePath("/admin/studio");
}
