"use client";

import { FormEvent, useState } from "react";
import { signIn, signOut } from "next-auth/react";

export function LoginClient({
  isLoggedIn,
  callbackUrl = "/dashboard",
  initialMode = "login",
}: {
  isLoggedIn: boolean;
  callbackUrl?: string;
  initialMode?: "login" | "register";
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register">(initialMode);

  async function submitCredentials(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    if (mode === "register") {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, phone }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Could not create account.");
        setLoading(false);
        return;
      }
      setMessage("Account created. Logging you in...");
    }

    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl,
      redirect: false,
    });
    if (result?.error) {
      setMessage("Invalid credentials.");
      setLoading(false);
      return;
    }

    window.location.href = callbackUrl;
    setLoading(false);
  }

  if (isLoggedIn) {
    return (
      <div className="card" style={{ display: "grid", gap: "0.7rem" }}>
        <p style={{ margin: 0 }}>You are already logged in.</p>
        <div style={{ display: "flex", gap: "0.6rem" }}>
          <a className="btn btn-primary" href="/dashboard">
            Go to dashboard
          </a>
          <button className="btn btn-secondary" onClick={() => signOut({ callbackUrl: "/" })}>
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div className="card" style={{ display: "grid", gap: "0.7rem" }}>
        <h2 style={{ margin: 0 }}>Login with Google</h2>
        <button
          className="btn btn-primary"
          onClick={() => signIn("google", { callbackUrl })}
        >
          Continue with Google
        </button>
      </div>

      <form className="card" onSubmit={submitCredentials} style={{ display: "grid", gap: "0.7rem" }}>
        <h2 style={{ margin: 0 }}>{mode === "login" ? "Login with Email" : "Create Account"}</h2>
        {mode === "register" ? (
          <input
            className="input"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Full name"
            required
          />
        ) : null}
        <input
          className="input"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
        <input
          className="input"
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
        />
        {mode === "register" ? (
          <input
            className="input"
            type="text"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Phone number"
          />
        ) : null}
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Please wait..." : mode === "login" ? "Login" : "Create Account"}
        </button>
        {message ? <p className="muted" style={{ margin: 0 }}>{message}</p> : null}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Need an account? Register" : "Already have account? Login"}
        </button>
      </form>
    </div>
  );
}
