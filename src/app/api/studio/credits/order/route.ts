import Razorpay from "razorpay";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureStudioDefaults, STUDIO_BRAND_NAME } from "@/lib/studio-pricing";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return NextResponse.json({ error: "Razorpay is not configured." }, { status: 500 });
  }

  const body = (await request.json()) as { packId?: string };
  if (!body.packId) {
    return NextResponse.json({ error: "packId is required." }, { status: 400 });
  }

  await ensureStudioDefaults(prisma);
  const pack = await prisma.studioCreditPack.findFirst({
    where: { id: body.packId, isActive: true },
  });
  if (!pack) {
    return NextResponse.json({ error: "Credit pack not found." }, { status: 404 });
  }

  const razorpay = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  const order = await razorpay.orders.create({
    amount: pack.amountInr * 100,
    currency: "INR",
    receipt: `studio_${session.user.id.slice(-8)}_${Date.now()}`,
    notes: {
      kind: "studio_credit_purchase",
      userId: session.user.id,
      packId: pack.id,
      credits: String(pack.credits),
    },
  });

  await prisma.studioCreditPurchase.create({
    data: {
      userId: session.user.id,
      packId: pack.id,
      amountInr: pack.amountInr,
      credits: pack.credits,
      razorpayOrderId: order.id,
      status: "PENDING",
    },
  });

  return NextResponse.json({
    order_id: order.id,
    amount: order.amount,
    currency: order.currency,
    key_id: keyId,
    description: `${pack.name} - ${pack.credits} ${STUDIO_BRAND_NAME} credits`,
  });
}
