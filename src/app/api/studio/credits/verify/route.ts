import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addStudioCredits } from "@/lib/studio-credits";

function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string, secret: string) {
  const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return NextResponse.json({ error: "Razorpay is not configured." }, { status: 500 });
  }

  const body = (await request.json()) as {
    razorpay_payment_id?: string;
    razorpay_order_id?: string;
    razorpay_signature?: string;
  };
  const paymentId = body.razorpay_payment_id;
  const orderId = body.razorpay_order_id;
  const signature = body.razorpay_signature;
  if (!paymentId || !orderId || !signature) {
    return NextResponse.json({ error: "Missing Razorpay verification fields." }, { status: 400 });
  }

  if (!verifyRazorpaySignature(orderId, paymentId, signature, keySecret)) {
    return NextResponse.json({ error: "Invalid payment signature." }, { status: 401 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const purchase = await tx.studioCreditPurchase.findUnique({
      where: { razorpayOrderId: orderId },
    });
    if (!purchase || purchase.userId !== session.user.id) {
      throw new Error("PURCHASE_NOT_FOUND");
    }
    if (purchase.status === "PAID") {
      const balance = await tx.studioCreditBalance.findUnique({ where: { userId: session.user.id } });
      return { balance: balance?.availableCredits ?? 0 };
    }

    await tx.studioCreditPurchase.update({
      where: { id: purchase.id },
      data: {
        status: "PAID",
        razorpayPaymentId: paymentId,
      },
    });
    const balance = await addStudioCredits({
      prisma: tx,
      userId: session.user.id,
      credits: purchase.credits,
      referenceId: purchase.id,
      note: `Studio credits purchased via Razorpay order ${orderId}`,
    });
    return { balance };
  });

  return NextResponse.json({ ok: true, balance: result.balance });
}
