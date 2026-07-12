"use client";

import { useState } from "react";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: { error?: { description?: string } }) => void) => void;
    };
  }
}

async function ensureCheckoutScript() {
  if (window.Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout script."));
    document.body.appendChild(script);
  });
}

export function StudioCreditCheckoutButton({
  packId,
  label,
}: {
  packId: string;
  label: string;
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleClick() {
    setLoading(true);
    setMessage("");
    try {
      await ensureCheckoutScript();
      const response = await fetch("/api/studio/credits/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = (await response.json()) as {
        order_id?: string;
        amount?: number;
        currency?: string;
        key_id?: string;
        description?: string;
        error?: string;
      };
      if (!response.ok || !data.order_id || !data.amount || !data.currency) {
        setMessage(data.error ?? "Could not start Studio credit checkout.");
        setLoading(false);
        return;
      }

      const keyId = data.key_id?.trim() || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!keyId || !window.Razorpay) {
        setMessage("Razorpay checkout is not ready.");
        setLoading(false);
        return;
      }

      const checkout = new window.Razorpay({
        key: keyId,
        amount: data.amount,
        currency: data.currency,
        name: "VFX COOK AI STUDIO",
        description: data.description ?? "Studio Credits",
        order_id: data.order_id,
        theme: { color: "#4f7dff" },
        modal: {
          ondismiss: () => {
            setMessage("Payment cancelled.");
            setLoading(false);
          },
        },
        handler: async (paymentResponse: {
          razorpay_payment_id?: string;
          razorpay_order_id?: string;
          razorpay_signature?: string;
        }) => {
          const verifyRes = await fetch("/api/studio/credits/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(paymentResponse),
          });
          const verifyJson = (await verifyRes.json()) as { ok?: boolean; error?: string };
          if (!verifyRes.ok || !verifyJson.ok) {
            setMessage(verifyJson.error ?? "Payment verification failed.");
            setLoading(false);
            return;
          }
          window.location.reload();
        },
      });

      checkout.on("payment.failed", (failureResponse) => {
        setMessage(failureResponse.error?.description ?? "Payment failed.");
        setLoading(false);
      });

      checkout.open();
    } catch (_error) {
      setMessage("Unexpected error while connecting to Razorpay.");
      setLoading(false);
    }
  }

  return (
    <div className="studio-pack-action">
      <button className="btn btn-primary" type="button" disabled={loading} onClick={handleClick}>
        {loading ? "Opening..." : label}
      </button>
      {message ? <p className="muted">{message}</p> : null}
    </div>
  );
}
