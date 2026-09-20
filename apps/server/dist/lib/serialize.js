import { renderLessonDescription } from './richtext.js';
export function toAuthor(user) {
    return {
        id: user.id,
        name: user.name ?? user.email?.split('@')[0] ?? 'Student',
        image: user.image
    };
}
/**
 * Lessons open in order: a lesson is watchable once every earlier lesson is complete.
 * A course may also expose its first lesson as a free preview to signed-out visitors.
 */
export function buildLessons(params) {
    const ordered = [...params.videos].sort((a, b) => a.order - b.order);
    let previousComplete = true;
    return ordered.map((video, index) => {
        const progress = params.progressByVideo.get(video.id);
        const isCompleted = Boolean(progress?.isCompleted);
        const isPreview = index === 0 && params.freePreviewFirstLesson;
        const sequentiallyOpen = index === 0 || previousComplete;
        const isLocked = !(isPreview || (params.hasAccess && sequentiallyOpen));
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
export function courseProgress(lessons) {
    const total = lessons.length;
    const completed = lessons.filter(lesson => lesson.isCompleted).length;
    return {
        total,
        completed,
        percent: total > 0 ? Math.round((completed / total) * 100) : 0,
        nextLessonId: lessons.find(lesson => !lesson.isCompleted && !lesson.isLocked)?.id ?? null
    };
}
//# sourceMappingURL=serialize.js.map