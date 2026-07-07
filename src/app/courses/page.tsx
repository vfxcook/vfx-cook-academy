import { CoursesCatalogClient } from "@/components/CoursesCatalogClient";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function CoursesPage() {
  const session = await auth();
  const courses = await prisma.course.findMany({
    where: { isPublished: true },
    orderBy: { createdAt: "desc" },
    include: {
      videos: {
        select: { id: true },
      },
    },
  });

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <section className="card" style={{ display: "grid", gap: "0.5rem" }}>
        <h1 style={{ margin: 0 }}>Courses</h1>
        <p className="muted" style={{ margin: 0 }}>
          Join your selected course, complete payment, and start learning instantly.
        </p>
      </section>

      <CoursesCatalogClient
        isLoggedIn={Boolean(session?.user)}
        isAdmin={session?.user?.role === "ADMIN"}
        courses={courses.map((course) => ({
          id: course.id,
          slug: course.slug,
          title: course.title,
          description: course.description,
          priceInr: course.priceInr,
          thumbnailUrl: course.thumbnailUrl,
          lessonsCount: course.videos.length,
          availableFrom: course.availableFrom ? course.availableFrom.toISOString() : null,
        }))}
      />
    </div>
  );
}
