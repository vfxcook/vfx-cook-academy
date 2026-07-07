import { prisma } from "@/lib/prisma";

export type CourseResource = {
  id: string;
  courseId: string;
  videoId?: string | null;
  title: string;
  description: string | null;
  fileUrl: string;
  fileType: string;
  createdAt: string;
};

export async function getAllCourseResources(): Promise<CourseResource[]> {
  const rows = await prisma.courseResource.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      courseId: true,
      videoId: true,
      title: true,
      description: true,
      fileUrl: true,
      fileType: true,
      createdAt: true,
    },
  });
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getCourseResources(courseId: string): Promise<CourseResource[]> {
  const rows = await getAllCourseResources();
  return rows.filter((row) => row.courseId === courseId);
}

export async function addCourseResource(input: {
  courseId: string;
  videoId?: string;
  title: string;
  description?: string;
  fileUrl: string;
  fileType: string;
}) {
  await prisma.courseResource.create({
    data: {
      courseId: input.courseId,
      videoId: input.videoId?.trim() || null,
      title: input.title,
      description: input.description?.trim() || null,
      fileUrl: input.fileUrl,
      fileType: input.fileType,
    },
  });
}
