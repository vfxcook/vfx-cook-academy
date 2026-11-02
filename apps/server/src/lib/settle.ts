import type { Prisma } from '@prisma/client';
import { addStudioCredits } from './studio.js';
import { makeGiftCode } from './utils.js';

type Tx = Prisma.TransactionClient;

/**
 * A pending request whose reference is a Razorpay order or payment-link id is an online
 * checkout that has not been paid yet. Everything else was typed in by a student after a
 * manual UPI transfer and is waiting on a human.
 */
const GATEWAY_PREFIXES = ['order_', 'plink_'];

export const isGatewayCheckout = (ref: string) => GATEWAY_PREFIXES.some(prefix => ref.startsWith(prefix));

export const gatewayCheckoutsOnly: Prisma.PaymentRequestWhereInput = {
  OR: GATEWAY_PREFIXES.map(prefix => ({ transactionRef: { startsWith: prefix } }))
};

export const manualTransfersOnly: Prisma.PaymentRequestWhereInput = {
  NOT: GATEWAY_PREFIXES.map(prefix => ({ transactionRef: { startsWith: prefix } }))
};

/**
 * Settles a verified gateway payment against its request. The status flip is a
 * conditional update, so when Checkout's verify call and Razorpay's webhook race, exactly
 * one of them wins and the other becomes a no-op — no second gift code, no double unlock.
 *
 * A dismissed (REJECTED) checkout is still settled: a valid signature means the money
 * arrived, and that has to outrank an admin tidying the queue.
 */
export async function settleCoursePayment(
  tx: Tx,
  params: { requestId: string; paymentRef: string; reviewer: string; note: string }
) {
  const claimed = await tx.paymentRequest.updateMany({
    where: { id: params.requestId, status: { in: ['PENDING', 'REJECTED'] } },
    data: {
      status: 'APPROVED',
      reviewedAt: new Date(),
      reviewedBy: params.reviewer,
      transactionRef: params.paymentRef,
      note: params.note
    }
  });
  if (claimed.count === 0) return { settled: false as const, giftId: null };

  const request = await tx.paymentRequest.findUniqueOrThrow({ where: { id: params.requestId } });

  if (request.isGift) {
    const coupon = await tx.giftCoupon.create({
      data: {
        code: makeGiftCode(),
        courseId: request.courseId,
        purchaserId: request.userId,
        amountInr: request.amountInr
      }
    });
    return { settled: true as const, giftId: coupon.id };
  }

  await tx.enrollment.upsert({
    where: { userId_courseId: { userId: request.userId, courseId: request.courseId } },
    create: {
      userId: request.userId,
      courseId: request.courseId,
      isActive: true,
      activatedAt: new Date()
    },
    update: { isActive: true, activatedAt: new Date(), licenseCode: null, licenseExpiresAt: null }
  });
  return { settled: true as const, giftId: null };
}

/** Same single-winner rule for studio credit packs, so a pack is never credited twice. */
export async function settleStudioPurchase(
  tx: Tx,
  params: { orderId: string; paymentId: string; userId?: string }
) {
  const purchase = await tx.studioCreditPurchase.findUnique({
    where: { razorpayOrderId: params.orderId }
  });
  if (!purchase || (params.userId && purchase.userId !== params.userId)) {
    return { found: false as const, settled: false, balance: 0 };
  }

  const claimed = await tx.studioCreditPurchase.updateMany({
    where: { id: purchase.id, status: { in: ['PENDING', 'FAILED', 'CANCELLED'] } },
    data: { status: 'PAID', razorpayPaymentId: params.paymentId }
  });

  if (claimed.count === 0) {
    const current = await tx.studioCreditBalance.findUnique({ where: { userId: purchase.userId } });
    return { found: true as const, settled: false, balance: current?.availableCredits ?? 0 };
  }

  const balance = await addStudioCredits({
    db: tx,
    userId: purchase.userId,
    credits: purchase.credits,
    referenceId: purchase.id,
    note: `Studio credits purchased via Razorpay order ${params.orderId}`
  });
  return { found: true as const, settled: true, balance };
}
