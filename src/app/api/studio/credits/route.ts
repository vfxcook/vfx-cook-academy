import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureStudioDefaults } from "@/lib/studio-pricing";
import { getOrCreateStudioBalance } from "@/lib/studio-credits";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureStudioDefaults(prisma);
  const [balance, packs, models, ledger, purchases] = await Promise.all([
    getOrCreateStudioBalance(prisma, session.user.id),
    prisma.studioCreditPack.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.studioModelPricing.findMany({
      where: { isEnabled: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.studioCreditLedger.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.studioCreditPurchase.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { pack: true },
    }),
  ]);

  return NextResponse.json({ balance, packs, models, ledger, purchases });
}
