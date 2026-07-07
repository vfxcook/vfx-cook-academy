"use client";

import { useState } from "react";

export function RazorpayCheckoutButton({ courseId }: { courseId: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleClick() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/razorpay/create-payment-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });

      const data = (await response.json()) as {
        paymentUrl?: string;
        redirectTo?: string;
        error?: string;
      };

      if (!response.ok) {
        setMessage(data.error ?? "Could not start checkout.");
        if (data.redirectTo) {
          window.location.href = data.redirectTo;
        }
        return;
      }

      if (!data.paymentUrl) {
        setMessage("Could not get Razorpay payment URL.");
        return;
      }

      window.location.href = data.paymentUrl;
    } catch (_error) {
      setMessage("Unexpected error while connecting to Razorpay.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      <button className="btn btn-primary" type="button" disabled={loading} onClick={handleClick}>
        {loading ? "Preparing payment..." : "Pay with Razorpay"}
      </button>
      {message ? (
        <p className="muted" style={{ margin: 0 }}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
