"use client";

import { useState } from "react";

export function PaymentRequestForm({
  courseId,
  amountInr,
}: {
  courseId: string;
  amountInr: number;
}) {
  const [transactionRef, setTransactionRef] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const response = await fetch("/api/payment-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseId,
        amountInr,
        transactionRef,
        note,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Failed to submit payment request.");
      setLoading(false);
      return;
    }

    setMessage("Payment proof submitted. We will review and email license code.");
    setTransactionRef("");
    setNote("");
    setLoading(false);
  }

  return (
    <form onSubmit={onSubmit} className="card" style={{ display: "grid", gap: "0.7rem" }}>
      <h3 style={{ margin: 0 }}>Submit Payment Confirmation</h3>
      <p className="muted" style={{ margin: 0 }}>
        After payment, enter Razorpay payment ID, UTR, or transaction reference.
      </p>
      <input
        className="input"
        value={transactionRef}
        onChange={(event) => setTransactionRef(event.target.value)}
        placeholder="Razorpay Payment ID / UTR / Transaction ID"
        required
      />
      <textarea
        className="textarea"
        rows={3}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Optional note (phone, payment app, etc.)"
      />
      <button className="btn btn-primary" type="submit" disabled={loading}>
        {loading ? "Submitting..." : "Submit for review"}
      </button>
      {message ? <p className="muted" style={{ margin: 0 }}>{message}</p> : null}
    </form>
  );
}
