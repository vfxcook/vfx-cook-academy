import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { adminWorkspaceNav } from "@/lib/admin-workspace";
import { auth } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  if (session.user.role !== "ADMIN") {
    return (
      <div className="admin-dashboard">
        <section className="card admin-empty-state">
          <h1>Admin Access Denied</h1>
          <p className="muted">Only admin users can open this workspace.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="admin-dashboard admin-route-shell">
      <section className="card admin-page-hero">
        <div>
          <p className="admin-eyebrow">VFX Cook Admin</p>
          <h1>Owner Command Center</h1>
          <p className="muted">Manage courses, students, payments, lessons, resources, and community activity.</p>
        </div>
        <Link className="btn btn-primary admin-hero-action" href="/admin/courses">
          Create Course
        </Link>
      </section>

      <nav className="admin-workspace-nav" aria-label="Admin workspace sections">
        {adminWorkspaceNav.map((item) => (
          <Link key={item.href} href={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
