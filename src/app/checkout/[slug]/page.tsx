import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { RazorpayCheckoutButton } from "@/components/RazorpayCheckoutButton";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatInr } from "@/lib/utils";

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/register?next=${encodeURIComponent(`/checkout/${slug}`)}`);
  }

  if (session.user.role === "ADMIN") {
    redirect(`/course/${slug}`);
  }

  const course = await prisma.course.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      priceInr: true,
      isPublished: true,
    },
  });

  if (!course || !course.isPublished) {
    notFound();
  }

  const existingEnrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: session.user.id,
        courseId: course.id,
      },
    },
    select: { isActive: true },
  });

  if (existingEnrollment?.isActive) {
    redirect("/dashboard");
  }

  return (
    <div style={{ display: "grid", gap: "1rem", maxWidth: 760, margin: "0 auto" }}>
      <section className="card" style={{ display: "grid", gap: "0.5rem" }}>
        <h1 style={{ margin: 0 }}>Checkout</h1>
        <p className="muted" style={{ margin: 0 }}>
          You are one step away from course access.
        </p>
      </section>

      <section className="card" style={{ display: "grid", gap: "0.8rem" }}>
        <h2 style={{ margin: 0 }}>{course.title}</h2>
        <p className="muted" style={{ margin: 0 }}>
          {course.description}
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <span className="muted">Total</span>
          <strong>{formatInr(course.priceInr)}</strong>
        </div>
        <RazorpayCheckoutButton courseId={course.id} />
        <p className="muted" style={{ margin: 0 }}>
          After successful payment, signature verification activates your enrollment automatically.
        </p>
        <Link className="btn btn-secondary" href="/dashboard">
          Go to dashboard
        </Link>
        {query.status ? (
          <p className="muted" style={{ margin: 0 }}>
            Razorpay callback received. You can continue from dashboard.
          </p>
        ) : null}
      </section>
    </div>
  );
}
