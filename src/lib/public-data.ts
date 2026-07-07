import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";

export const getPublishedCoursesCached = unstable_cache(
  async () =>
    prisma.course.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: "desc" },
      include: {
        videos: {
          select: { id: true },
        },
      },
    }),
  ["published-courses"],
  { revalidate: 120 },
);
