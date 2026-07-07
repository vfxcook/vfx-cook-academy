import { LoginClient } from "@/components/LoginClient";
import { auth } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const callbackUrl = params.next && params.next.startsWith("/") ? params.next : "/dashboard";
  const initialMode = params.mode === "register" ? "register" : "login";

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", display: "grid", gap: "1rem" }}>
      <h1 style={{ marginBottom: 0 }}>Login</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Login with email/password or Google.
      </p>
      <LoginClient
        isLoggedIn={Boolean(session?.user)}
        callbackUrl={callbackUrl}
        initialMode={initialMode}
      />
    </div>
  );
}
