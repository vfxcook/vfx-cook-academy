import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { env } from './env.js';
import { ApiError } from './http.js';
import { timingSafeEqual } from './utils.js';
let client = null;
export function razorpay() {
    if (!env.razorpay.enabled) {
        throw new ApiError(503, 'Online payment is not switched on yet. Use the QR transfer option below.', 'RAZORPAY_UNCONFIGURED');
    }
    if (!client) {
        client = new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret });
    }
    return client;
}
export function verifyCheckoutSignature(orderId, paymentId, signature) {
    const expected = crypto
        .createHmac('sha256', env.razorpay.keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
    return timingSafeEqual(expected, signature);
}
export function verifyWebhookSignature(rawBody, signature) {
    if (!env.razorpay.webhookSecret)
        return false;
    const expected = crypto
        .createHmac('sha256', env.razorpay.webhookSecret)
        .update(rawBody)
        .digest('hex');
    return timingSafeEqual(expected, signature);
}
export async function createOrder(params) {
    try {
        const order = await razorpay().orders.create({
            amount: params.amountInr * 100,
            currency: 'INR',
            receipt: params.receipt,
            notes: params.notes
        });
        return order;
    }
    catch (error) {
        if (error instanceof ApiError)
            throw error;
        const detail = error;
        throw new ApiError(detail.statusCode === 401 ? 502 : 502, detail.error?.description ?? detail.message ?? 'Could not reach Razorpay.', 'RAZORPAY_ERROR');
    }
}
//# sourceMappingURL=razorpay.js.map