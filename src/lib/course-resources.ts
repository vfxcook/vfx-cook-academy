import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

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

const resourceFilePath = path.join(process.cwd(), "data", "course-resources.json");

async function ensureStore() {
  await fs.mkdir(path.dirname(resourceFilePath), { recursive: true });
  try {
    await fs.access(resourceFilePath);
  } catch {
    await fs.writeFile(resourceFilePath, "[]", "utf8");
  }
}

export async function getAllCourseResources(): Promise<CourseResource[]> {
  await ensureStore();
  const content = await fs.readFile(resourceFilePath, "utf8");
  try {
    return JSON.parse(content) as CourseResource[];
  } catch {
    return [];
  }
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
  const rows = await getAllCourseResources();
  rows.unshift({
    id: randomUUID(),
    courseId: input.courseId,
    videoId: input.videoId?.trim() || null,
    title: input.title,
    description: input.description?.trim() || null,
    fileUrl: input.fileUrl,
    fileType: input.fileType,
    createdAt: new Date().toISOString(),
  });
  await fs.writeFile(resourceFilePath, JSON.stringify(rows, null, 2), "utf8");
}
