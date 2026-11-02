import { renderLessonDescription } from './richtext.js';

export type LessonAuthor = { id: string; name: string | null; email: string | null; image: string | null };

type VideoRow = {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string;
  order: number;
  durationSec: number;
};

type ResourceRow = {
  id: string;
  videoId: string | null;
  title: string;
  description: string | null;
  fileUrl: string;
  fileType: string;
};

export type LessonDto = {
  id: string;
  title: string;
  descriptionHtml: string;
  order: number;
  durationSec: number;
  videoUrl: string | null;
  isLocked: boolean;
  isCompleted: boolean;
  progressPercent: number;
  resources: Array<Omit<ResourceRow, 'videoId'>>;
};

/** Other students only ever see a name — never an email, not even its local part. */
export function toAuthor(user: LessonAuthor) {
  return { id: user.id, name: user.name?.trim() || 'Student', image: user.image };
}

/**
 * Lessons open in order: a lesson is watchable once every earlier lesson is complete.
 * A course may also expose its first lesson as a free preview to signed-out visitors.
 */
export function buildLessons(params: {
  videos: VideoRow[];
  resources: ResourceRow[];
  progressByVideo: Map<string, { progressPercent: number; isCompleted: boolean }>;
  hasAccess: boolean;
  freePreviewFirstLesson: boolean;
  /** Admins review the whole course, so the sequence does not gate them. */
  unlockAll?: boolean;
}): LessonDto[] {
  const ordered = [...params.videos].sort((a, b) => a.order - b.order);
  let previousComplete = true;

  return ordered.map((video, index) => {
    const progress = params.progressByVideo.get(video.id);
    const isCompleted = Boolean(progress?.isCompleted);

    const isPreview = index === 0 && params.freePreviewFirstLesson;
    const sequentiallyOpen = index === 0 || previousComplete;
    const isLocked = !(params.unlockAll || isPreview || (params.hasAccess && sequentiallyOpen));

    previousComplete = previousComplete && isCompleted;

    return {
      id: video.id,
      title: video.title,
      descriptionHtml: renderLessonDescription(video.description),
      order: video.order,
      durationSec: video.durationSec,
      videoUrl: isLocked ? null : video.videoUrl,
      isLocked,
      isCompleted,
      progressPercent: progress?.progressPercent ?? 0,
      resources: isLocked
        ? []
        : params.resources
            .filter(resource => resource.videoId === video.id)
            .map(({ videoId: _videoId, ...rest }) => rest)
    };
  });
}

export function courseProgress(lessons: LessonDto[]) {
  const total = lessons.length;
  const completed = lessons.filter(lesson => lesson.isCompleted).length;
  return {
    total,
    completed,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    nextLessonId: lessons.find(lesson => !lesson.isCompleted && !lesson.isLocked)?.id ?? null
  };
}
