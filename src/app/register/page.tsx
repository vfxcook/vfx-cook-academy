import { LoginClient } from "@/components/LoginClient";
import { auth } from "@/lib/auth";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const callbackUrl = params.next && params.next.startsWith("/") ? params.next : "/dashboard";

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", display: "grid", gap: "1rem" }}>
      <h1 style={{ marginBottom: 0 }}>Create Account</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Register first, then continue to payment.
      </p>
      <LoginClient
        isLoggedIn={Boolean(session?.user)}
        callbackUrl={callbackUrl}
        initialMode="register"
      />
    </div>
  );
}
