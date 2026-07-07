import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, phone: true },
  });

  async function completeOnboarding(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();

    await prisma.user.update({
      where: { id: userId },
      data: {
        name: name || null,
        phone: phone || null,
      },
    });
    redirect("/dashboard");
  }

  return (
    <div className="card" style={{ maxWidth: 620, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>Complete Your Profile</h1>
      <p className="muted">We collect your contact details for enrollment and support.</p>
      <form action={completeOnboarding} style={{ display: "grid", gap: "0.7rem" }}>
        <label>
          Full Name
          <input className="input" name="name" defaultValue={user?.name ?? ""} />
        </label>
        <label>
          Email (readonly)
          <input className="input" value={user?.email ?? ""} readOnly />
        </label>
        <label>
          Phone
          <input className="input" name="phone" defaultValue={user?.phone ?? ""} required />
        </label>
        <button className="btn btn-primary" type="submit">
          Save and continue
        </button>
      </form>
    </div>
  );
}
