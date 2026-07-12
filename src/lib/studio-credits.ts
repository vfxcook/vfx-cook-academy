import type { Prisma, PrismaClient } from "@/generated/prisma";

type TxClient = Prisma.TransactionClient | PrismaClient;

export async function getOrCreateStudioBalance(prisma: TxClient, userId: string) {
  return prisma.studioCreditBalance.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

export async function addStudioCredits({
  prisma,
  userId,
  credits,
  referenceId,
  note,
}: {
  prisma: TxClient;
  userId: string;
  credits: number;
  referenceId?: string;
  note?: string;
}) {
  const current = await getOrCreateStudioBalance(prisma, userId);
  const nextBalance = current.availableCredits + credits;
  await prisma.studioCreditBalance.update({
    where: { userId },
    data: {
      availableCredits: nextBalance,
      lifetimePurchasedCredits: { increment: credits },
    },
  });
  await prisma.studioCreditLedger.create({
    data: {
      userId,
      type: "PURCHASE",
      deltaCredits: credits,
      balanceAfter: nextBalance,
      referenceId,
      note,
    },
  });
  return nextBalance;
}

export async function spendStudioCredits({
  prisma,
  userId,
  credits,
  referenceId,
  note,
}: {
  prisma: TxClient;
  userId: string;
  credits: number;
  referenceId?: string;
  note?: string;
}) {
  const current = await getOrCreateStudioBalance(prisma, userId);
  if (current.availableCredits < credits) {
    throw new Error("INSUFFICIENT_STUDIO_CREDITS");
  }
  const nextBalance = current.availableCredits - credits;
  await prisma.studioCreditBalance.update({
    where: { userId },
    data: {
      availableCredits: nextBalance,
      lifetimeUsedCredits: { increment: credits },
    },
  });
  await prisma.studioCreditLedger.create({
    data: {
      userId,
      type: "GENERATION_DEBIT",
      deltaCredits: -credits,
      balanceAfter: nextBalance,
      referenceId,
      note,
    },
  });
  return nextBalance;
}

export async function refundStudioCredits({
  prisma,
  userId,
  credits,
  referenceId,
  note,
}: {
  prisma: TxClient;
  userId: string;
  credits: number;
  referenceId?: string;
  note?: string;
}) {
  const current = await getOrCreateStudioBalance(prisma, userId);
  const nextBalance = current.availableCredits + credits;
  
  await prisma.studioCreditBalance.update({
    where: { userId },
    data: {
      availableCredits: nextBalance,
      lifetimeUsedCredits: { decrement: credits },
    },
  });
  
  await prisma.studioCreditLedger.create({
    data: {
      userId,
      type: "REFUND",
      deltaCredits: credits,
      balanceAfter: nextBalance,
      referenceId,
      note,
    },
  });
  
  return nextBalance;
}
