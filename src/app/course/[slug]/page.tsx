import Link from "next/link";
import { notFound } from "next/navigation";

import { ClassroomPlayer } from "@/components/ClassroomPlayer";
import { auth } from "@/lib/auth";
import { getCourseResources } from "@/lib/course-resources";
import { prisma } from "@/lib/prisma";
import { formatInr } from "@/lib/utils";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();

  const course = await prisma.course.findUnique({
    where: { slug },
    include: {
      videos: {
        orderBy: { order: "asc" },
        include: {
          comments: {
            include: {
              user: { select: { name: true, email: true, image: true } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  if (!course || !course.isPublished) {
    notFound();
  }

  const enrollment = session?.user?.id
    ? await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId: session.user.id,
            courseId: course.id,
          },
        },
      })
    : null;

  const isAdmin = session?.user?.role === "ADMIN";
  const isActive = Boolean(enrollment?.isActive);
  const hasAccess = isAdmin || isActive;
  const isReleased = !course.availableFrom || course.availableFrom.getTime() <= Date.now();
  const canOpenClassroom = hasAccess && (isReleased || isAdmin);
  const firstVideo = course.videos[0];
  const videoIds = course.videos.map((video) => video.id);
  const progressRows = session?.user?.id
    ? await prisma.videoProgress.findMany({
        where: {
          userId: session.user.id,
          videoId: { in: videoIds },
          isCompleted: true,
        },
        select: { videoId: true },
      })
    : [];
  const completedVideoIds = progressRows.map((row) => row.videoId);
  const totalLessons = course.videos.length;

  const activeMembers = await prisma.enrollment.findMany({
    where: {
      courseId: course.id,
      isActive: true,
    },
    include: {
      user: {
        select: { name: true, email: true },
      },
    },
  });
  const completionCounts = await prisma.videoProgress.groupBy({
    by: ["userId"],
    where: {
      isCompleted: true,
      video: {
        courseId: course.id,
      },
    },
    _count: {
      _all: true,
    },
  });
  const completionMap = new Map(completionCounts.map((row) => [row.userId, row._count._all]));
  const leaderboardRows = activeMembers
    .map((member) => {
      const completedLessons = completionMap.get(member.userId) ?? 0;
      const progressPercent =
        totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
      return {
        userLabel: member.user.name ?? member.user.email ?? "Learner",
        completedLessons,
        totalLessons,
        progressPercent,
      };
    })
    .sort((a, b) => b.progressPercent - a.progressPercent);
  const resources = await getCourseResources(course.id);

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <section
        className="card"
        style={{
          display: "grid",
          gap: "0.5rem",
          backgroundImage:
            "linear-gradient(rgba(6,10,18,0.72), rgba(6,10,18,0.72)), url('https://images.unsplash.com/photo-1626544827763-d516dce335e2?auto=format&fit=crop&w=1400&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <h1 style={{ margin: 0 }}>{course.title}</h1>
        <p className="muted" style={{ margin: 0, maxWidth: 780 }}>
          {course.description}
        </p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <strong>{formatInr(course.priceInr)}</strong>
          {hasAccess ? <span>Access: Active</span> : <span>Access: Locked</span>}
          {isAdmin ? <span className="muted">Admin bypass enabled</span> : null}
          {!isReleased ? (
            <span className="begin-highlight">
              Begins on{" "}
              {course.availableFrom?.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
              })}
            </span>
          ) : null}
        </div>
      </section>

      {!session?.user ? (
        <section className="card">
          <p style={{ marginTop: 0 }}>Login required to purchase or view this course.</p>
          <Link
            className="btn btn-primary"
            href={`/register?next=${encodeURIComponent(`/checkout/${course.slug}`)}`}
          >
            Register to continue
          </Link>
        </section>
      ) : null}

      {session?.user && !hasAccess ? (
        <section
          className="card"
          style={{
            display: "grid",
            gap: "1rem",
            backgroundImage:
              "linear-gradient(rgba(7,12,24,0.85), rgba(7,12,24,0.85)), url('https://images.unsplash.com/photo-1574717024453-3540567f7a10?auto=format&fit=crop&w=1400&q=80')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <h2 style={{ margin: 0 }}>Pay and Unlock</h2>
          <p className="muted" style={{ margin: 0 }}>
            Click checkout, complete Razorpay payment, and you will be redirected to your dashboard
            with access enabled.
          </p>
          <Link className="btn btn-primary" href={`/checkout/${course.slug}`}>
            Go to Checkout - {formatInr(course.priceInr)}
          </Link>
        </section>
      ) : null}

      {session?.user && hasAccess && !isReleased && !isAdmin ? (
        <section className="card" style={{ display: "grid", gap: "0.7rem" }}>
          <h2 style={{ margin: 0 }}>Course access scheduled</h2>
          <p className="muted" style={{ margin: 0 }}>
            Your enrollment is active. This batch will begin on{" "}
            <span className="begin-highlight">
              {course.availableFrom?.toLocaleDateString("en-IN", { day: "numeric", month: "long" })}
            </span>
            .
          </p>
          <Link className="btn btn-secondary" href="/dashboard">
            Back to dashboard
          </Link>
        </section>
      ) : null}

      {session?.user && canOpenClassroom && firstVideo ? (
        <section style={{ display: "grid", gap: "1rem" }}>
          <ClassroomPlayer
            courseTitle={course.title}
            videos={course.videos.map((video) => ({
              id: video.id,
              title: video.title,
              description: video.description,
              videoUrl: video.videoUrl,
              order: video.order,
              durationSec: video.durationSec,
              comments: video.comments.map((comment) => ({
                id: comment.id,
                timestamp: comment.timestamp,
                text: comment.text,
                createdAt: comment.createdAt.toISOString(),
                user: {
                  name: comment.user.name,
                  email: comment.user.email,
                  image: comment.user.image,
                },
              })),
            }))}
            completedVideoIds={completedVideoIds}
            resources={resources.map((resource) => ({
              id: resource.id,
              title: resource.title,
              description: resource.description,
              fileUrl: resource.fileUrl,
              fileType: resource.fileType,
              videoId: resource.videoId ?? null,
            }))}
            leaderboardRows={leaderboardRows}
          />
        </section>
      ) : null}

      {session?.user && canOpenClassroom && !firstVideo ? (
        <section className="card" style={{ display: "grid", gap: "0.7rem" }}>
          <h2 style={{ margin: 0 }}>Course setup in progress</h2>
          <p className="muted" style={{ margin: 0 }}>
            This course has no lessons yet, so Classroom and Community are not available right now.
          </p>
          {isAdmin ? (
            <Link className="btn btn-primary" href="/admin#add-lesson-panel">
              Add first lesson from Admin
            </Link>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Please check back after your mentor publishes the first lesson.
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
