"use client";

import { useState } from "react";

export function AdminPaymentActions({
  id,
}: {
  id: string;
}) {
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [message, setMessage] = useState("");

  async function runAction(type: "approve" | "reject") {
    setLoading(type);
    setMessage("");
    const response = await fetch(`/api/payment-requests/${id}/${type}`, {
      method: "POST",
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Action failed.");
      setLoading(null);
      return;
    }
    setMessage(type === "approve" ? "Approved." : "Rejected.");
    setLoading(null);
    window.location.reload();
  }

  return (
    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
      <button
        className="btn btn-primary"
        type="button"
        disabled={loading !== null}
        onClick={() => runAction("approve")}
      >
        {loading === "approve" ? "Approving..." : "Approve"}
      </button>
      <button
        className="btn btn-secondary"
        type="button"
        disabled={loading !== null}
        onClick={() => runAction("reject")}
      >
        {loading === "reject" ? "Rejecting..." : "Reject"}
      </button>
      {message ? <span className="muted">{message}</span> : null}
    </div>
  );
}
