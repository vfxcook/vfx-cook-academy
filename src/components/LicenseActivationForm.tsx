"use client";

import { useState } from "react";

export function LicenseActivationForm({ courseId }: { courseId: string }) {
  const [licenseCode, setLicenseCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const response = await fetch("/api/license", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseId,
        licenseCode: licenseCode.toUpperCase(),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Could not activate license.");
      setLoading(false);
      return;
    }

    setMessage("License activated. You can now open the course videos.");
    setLicenseCode("");
    setLoading(false);
    window.location.reload();
  }

  return (
    <form onSubmit={onSubmit} className="card" style={{ display: "grid", gap: "0.65rem" }}>
      <h4 style={{ margin: 0 }}>Activate Course with One-Time Code</h4>
      <input
        className="input"
        required
        value={licenseCode}
        onChange={(event) => setLicenseCode(event.target.value)}
        placeholder="Enter code from email"
      />
      <button className="btn btn-primary" type="submit" disabled={loading}>
        {loading ? "Activating..." : "Activate"}
      </button>
      {message ? <p className="muted" style={{ margin: 0 }}>{message}</p> : null}
    </form>
  );
}
