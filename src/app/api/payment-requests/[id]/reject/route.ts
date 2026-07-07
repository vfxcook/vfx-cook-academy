import { PaymentStatus } from "@/generated/prisma";
import { NextResponse } from "next/server";

import { isAdminSession } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

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
  });

  if (!payment) {
    return NextResponse.json({ error: "Payment request not found" }, { status: 404 });
  }

  if (payment.status !== PaymentStatus.PENDING) {
    return NextResponse.json({ error: "Payment request already reviewed" }, { status: 400 });
  }

  await prisma.paymentRequest.update({
    where: { id: payment.id },
    data: {
      status: PaymentStatus.REJECTED,
      reviewedAt: new Date(),
      reviewedBy: "admin",
    },
  });

  return NextResponse.json({ ok: true });
}
