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
    <div className="checkout-shell">
      <section className="card checkout-hero">
        <p className="admin-eyebrow">Secure Enrollment</p>
        <h1>Complete your VFX Cook Academy access</h1>
        <p className="muted">
          Pay once, verify automatically, and continue from your dashboard after Razorpay confirms the payment.
        </p>
      </section>

      <section className="card checkout-card">
        <div className="checkout-summary">
          <div>
            <span className="muted">Course</span>
            <h2>{course.title}</h2>
            <p className="muted">{course.description}</p>
          </div>
          <div className="checkout-total">
            <span>Total</span>
            <strong>{formatInr(course.priceInr)}</strong>
          </div>
        </div>

        <ul className="checkout-trust-list" aria-label="What happens after payment">
          <li>Instant enrollment after Razorpay signature verification.</li>
          <li>Dashboard access unlocks your course, progress, comments, and community.</li>
          <li>Payment issues can be handled through WhatsApp support with your registered email.</li>
        </ul>

        <div className="checkout-actions">
          <RazorpayCheckoutButton courseId={course.id} />
          <Link className="btn btn-secondary" href="/dashboard">
            Go to dashboard
          </Link>
        </div>

        <div className="checkout-help">
          <strong>Need help?</strong>
          <p className="muted">
            If payment succeeds but access does not appear, message us on WhatsApp and we will verify it manually.
          </p>
          <a className="btn btn-secondary" href="https://wa.me/919353720487" target="_blank" rel="noopener noreferrer">
            WhatsApp Support
          </a>
        </div>

        {query.status ? (
          <p className="muted" style={{ margin: 0 }} aria-live="polite">
            Razorpay callback received. You can continue from dashboard.
          </p>
        ) : null}
      </section>
    </div>
  );
}
