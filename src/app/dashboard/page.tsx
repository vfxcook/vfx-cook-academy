import Link from "next/link";
import { redirect } from "next/navigation";

import { PaymentStatus } from "@/generated/prisma";
import { LicenseActivationForm } from "@/components/LicenseActivationForm";
import { SignOutButton } from "@/components/SignOutButton";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatInr } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { phone: true },
  });
  if (!user?.phone) {
    redirect("/onboarding");
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: session.user.id },
    include: {
      course: {
        include: {
          videos: {
            select: { id: true },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const payments = await prisma.paymentRequest.findMany({
    where: { userId: session.user.id },
    include: {
      course: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <section className="card" style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ marginTop: 0, marginBottom: "0.3rem" }}>Your Dashboard</h1>
          <p className="muted" style={{ margin: 0 }}>
            Manage course access, payments and license activation.
          </p>
        </div>
        <SignOutButton />
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>My Courses</h2>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {enrollments.length === 0 ? (
            <p className="muted">No enrollments yet. Buy a course from home page.</p>
          ) : (
            await Promise.all(
              enrollments.map(async (item) => {
                const totalVideos = item.course.videos.length;
                const completedCount = await prisma.videoProgress.count({
                  where: {
                    userId: session.user.id,
                    isCompleted: true,
                    video: {
                      courseId: item.courseId,
                    },
                  },
                });
                const progressPercent =
                  totalVideos > 0 ? Math.round((completedCount / totalVideos) * 100) : 0;
                const isReleased =
                  !item.course.availableFrom || item.course.availableFrom.getTime() <= Date.now();

                return (
                  <article key={item.id} className="card" style={{ borderColor: "#2d3b5d" }}>
                    <h3 style={{ marginTop: 0 }}>{item.course.title}</h3>
                    <p className="muted">
                      Access: {item.isActive ? "Active" : "Pending activation"}
                    </p>
                    {!isReleased ? (
                      <p className="muted" style={{ marginTop: 0 }}>
                        <span className="begin-highlight">
                          Begins on{" "}
                          {item.course.availableFrom?.toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "long",
                          })}
                        </span>
                      </p>
                    ) : null}
                    <p className="muted" style={{ marginTop: 0 }}>
                      Progress: {completedCount}/{totalVideos} lessons ({progressPercent}%)
                    </p>
                    <div
                      style={{
                        height: 8,
                        borderRadius: 999,
                        background: "#1e2a45",
                        overflow: "hidden",
                        marginBottom: "0.6rem",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${progressPercent}%`,
                          background: "linear-gradient(90deg, #5d80ff, #8a6dff)",
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <span>{formatInr(item.course.priceInr)}</span>
                      {item.isActive && isReleased ? (
                        <Link className="btn btn-primary" href={`/course/${item.course.slug}`}>
                          Continue course
                        </Link>
                      ) : item.isActive ? (
                        <span className="muted">Locked until batch start date</span>
                      ) : (
                        <LicenseActivationForm courseId={item.courseId} />
                      )}
                    </div>
                  </article>
                );
              }),
            )
          )}
        </div>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Payment Requests</h2>
        <div style={{ display: "grid", gap: "0.6rem" }}>
          {payments.length === 0 ? (
            <p className="muted">No payment requests submitted yet.</p>
          ) : (
            payments.map((item) => (
              <div key={item.id} style={{ borderTop: "1px solid #293a5f", paddingTop: "0.5rem" }}>
                <strong>{item.course.title}</strong> - {formatInr(item.amountInr)} -{" "}
                {item.status === PaymentStatus.PENDING
                  ? "Pending review"
                  : item.status === PaymentStatus.APPROVED
                    ? "Approved (check email for license code)"
                    : "Rejected"}
                <div className="muted">Ref: {item.transactionRef}</div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
