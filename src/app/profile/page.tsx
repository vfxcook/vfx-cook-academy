import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      image: true,
      passwordHash: true,
    },
  });
  if (!user) {
    redirect("/login");
  }
  const userId = user.id;

  async function updateProfile(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const existingImage = String(formData.get("existingImage") ?? "").trim();
    const imageFile = formData.get("imageFile");
    let image = existingImage || null;
    if (imageFile instanceof File && imageFile.size > 0) {
      if (!imageFile.type.startsWith("image/")) {
        throw new Error("Profile image must be an image file.");
      }
      if (imageFile.size > MAX_PROFILE_IMAGE_BYTES) {
        throw new Error("Profile image is too large. Please upload under 5MB.");
      }
      const ext = path.extname(imageFile.name) || ".jpg";
      const fileName = `${Date.now()}-${randomUUID()}${ext.toLowerCase()}`;
      const targetDir = path.join(process.cwd(), "public", "uploads", "profiles");
      await fs.mkdir(targetDir, { recursive: true });
      await fs.writeFile(path.join(targetDir, fileName), Buffer.from(await imageFile.arrayBuffer()));
      image = `/uploads/profiles/${fileName}`;
    }
    await prisma.user.update({
      where: { id: userId },
      data: { name: name || null, phone: phone || null, image },
    });
    redirect("/profile");
  }

  async function changePassword(formData: FormData) {
    "use server";
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");
    if (newPassword.length < 8) {
      throw new Error("New password must be at least 8 characters.");
    }
    const latest = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!latest?.passwordHash) {
      throw new Error("No existing password found for this account.");
    }
    const isValid = await verifyPassword(currentPassword, latest.passwordHash);
    if (!isValid) {
      throw new Error("Current password is incorrect.");
    }
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    redirect("/profile");
  }

  return (
    <div style={{ display: "grid", gap: "1rem", maxWidth: 760, margin: "0 auto" }}>
      <section className="card">
        <h1 style={{ marginTop: 0, marginBottom: "0.35rem" }}>My Profile</h1>
        <p className="muted" style={{ margin: 0 }}>
          Manage your account details and password.
        </p>
      </section>

      <section className="card" style={{ display: "grid", gap: "0.65rem" }}>
        <h2 style={{ margin: 0 }}>Account Details</h2>
        <form action={updateProfile} style={{ display: "grid", gap: "0.6rem" }}>
          <label>
            Name
            <input className="input" name="name" defaultValue={user.name ?? ""} />
          </label>
          <label>
            Email
            <input className="input" value={user.email ?? ""} readOnly />
          </label>
          <label>
            Phone
            <input className="input" name="phone" defaultValue={user.phone ?? ""} />
          </label>
          <label>
            Profile Photo Upload
            <input className="input" type="file" name="imageFile" accept="image/*" />
          </label>
          <input type="hidden" name="existingImage" value={user.image ?? ""} />
          {user.image ? (
            <img
              src={user.image}
              alt="Profile preview"
              style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover" }}
            />
          ) : null}
          <button className="btn btn-primary" type="submit">
            Save profile
          </button>
        </form>
      </section>

      <section className="card" style={{ display: "grid", gap: "0.65rem" }}>
        <h2 style={{ margin: 0 }}>Change Password</h2>
        <form action={changePassword} style={{ display: "grid", gap: "0.6rem" }}>
          <input className="input" type="password" name="currentPassword" placeholder="Current password" required />
          <input className="input" type="password" name="newPassword" placeholder="New password (min 8 chars)" required />
          <button className="btn btn-primary" type="submit">
            Update password
          </button>
        </form>
      </section>
    </div>
  );
}
