import { getAllCourseResources } from "@/lib/course-resources";
import { prisma } from "@/lib/prisma";

export function formatCompactDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(date);
}

export function toDateInputValue(date: Date | null) {
  if (!date) return "";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function getAdminCourses() {
  return prisma.course.findMany({
    orderBy: { createdAt: "desc" },
    include: { videos: { orderBy: { order: "asc" } }, enrollments: { where: { isActive: true } } },
  });
}

export async function getAdminOverviewData() {
  const [courses, resources, recentDoubts, activeMembers, recentPayments, pendingDoubts, completedProgress, lastLesson] =
    await Promise.all([
      getAdminCourses(),
      getAllCourseResources(),
      prisma.timestampComment.findMany({
        orderBy: { createdAt: "desc" },
        take: 4,
        include: {
          user: { select: { name: true, email: true } },
          video: { select: { title: true, order: true } },
        },
      }),
      prisma.enrollment.groupBy({ by: ["userId"], where: { isActive: true } }),
      prisma.paymentRequest.findMany({
        orderBy: { createdAt: "desc" },
        take: 4,
        include: {
          user: { select: { name: true, email: true, phone: true } },
          course: { select: { title: true, priceInr: true } },
        },
      }),
      prisma.timestampComment.count(),
      prisma.videoProgress.count({ where: { isCompleted: true } }),
      prisma.video.findFirst({ orderBy: { createdAt: "desc" }, include: { course: { select: { title: true } } } }),
    ]);

  const publishedCourses = courses.filter((course) => course.isPublished);
  const videos = courses.flatMap((course) => course.videos);
  const possibleProgress = Math.max(
    courses.reduce((sum, course) => sum + course.videos.length * course.enrollments.length, 0),
    1,
  );

  return {
    activeMembers,
    completionRate: Math.round((completedProgress / possibleProgress) * 100),
    courses,
    lastLesson,
    pendingDoubts,
    publishedCourses,
    recentDoubts,
    recentPayments,
    resources,
    videos,
  };
}

export async function getAdminStudents() {
  const students = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      enrollments: {
        include: {
          course: {
            select: {
              id: true,
              title: true,
              slug: true,
              priceInr: true,
              videos: { select: { id: true } },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      },
      payments: {
        include: { course: { select: { title: true } } },
        orderBy: { createdAt: "desc" },
      },
      videoProgress: {
        where: { isCompleted: true },
        select: { video: { select: { courseId: true } }, updatedAt: true },
      },
    },
  });

  return students.map((student) => {
    const courses = student.enrollments.map((enrollment) => {
      const totalLessons = enrollment.course.videos.length;
      const completedLessons = student.videoProgress.filter(
        (progress) => progress.video.courseId === enrollment.courseId,
      ).length;

      return {
        isActive: enrollment.isActive,
        progressPercent: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
        slug: enrollment.course.slug,
        title: enrollment.course.title,
      };
    });
    const latestActivityDates = [
      student.updatedAt,
      ...student.enrollments.map((enrollment) => enrollment.updatedAt),
      ...student.payments.map((payment) => payment.updatedAt),
      ...student.videoProgress.map((progress) => progress.updatedAt),
    ];

    return {
      courses,
      email: student.email ?? "No email",
      id: student.id,
      joinedAt: student.createdAt,
      lastActivity: latestActivityDates.sort((a, b) => b.getTime() - a.getTime())[0],
      latestPayment: student.payments[0],
      name: student.name ?? "Unnamed student",
      phone: student.phone ?? "No phone",
    };
  });
}

export async function getAdminPayments() {
  return prisma.paymentRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      course: { select: { title: true, priceInr: true } },
    },
  });
}

export async function getAdminLessonsData() {
  const [courses, resources] = await Promise.all([getAdminCourses(), getAllCourseResources()]);
  const resourcesByVideo = new Map<string, number>();
  for (const resource of resources) {
    if (!resource.videoId) continue;
    resourcesByVideo.set(resource.videoId, (resourcesByVideo.get(resource.videoId) ?? 0) + 1);
  }
  const lessons = courses.flatMap((course) => course.videos.map((video) => ({ course, video })));

  return { courses, lessons, resources, resourcesByVideo };
}

export async function getAdminCommunity() {
  return prisma.timestampComment.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      user: { select: { name: true, email: true } },
      video: { select: { title: true, order: true, course: { select: { title: true, slug: true } } } },
    },
  });
}
