const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

type RazorpayResult = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: { name?: string; email?: string; contact?: string };
  theme: { color: string };
  handler: (response: RazorpayResult) => void;
  modal: { ondismiss: () => void };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

let loader: Promise<void> | null = null;

/** Loads the gateway script once and reuses the same promise for later opens. */
export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  if (loader) return loader;

  loader = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loader = null;
      reject(new Error('Could not reach the payment gateway. Check your connection and retry.'));
    };
    document.head.appendChild(script);
  });

  return loader;
}

export async function openCheckout(params: {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name?: string; email?: string; contact?: string };
}): Promise<RazorpayResult | null> {
  await loadRazorpay();
  if (!window.Razorpay) throw new Error('The payment gateway did not load.');

  return new Promise<RazorpayResult | null>(resolve => {
    const checkout = new window.Razorpay!({
      key: params.keyId,
      amount: params.amount,
      currency: params.currency,
      name: params.name,
      description: params.description,
      order_id: params.orderId,
      prefill: params.prefill,
      theme: { color: '#e60175' },
      handler: response => resolve(response),
      // Closing the sheet resolves null so the caller can clear its busy state.
      modal: { ondismiss: () => resolve(null) }
    });
    checkout.open();
  });
}
