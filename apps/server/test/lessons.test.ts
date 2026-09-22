import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildLessons, courseProgress } from '../src/lib/serialize.js';

const videos = [1, 2, 3].map(order => ({
  id: `v${order}`,
  title: `Lesson ${order}`,
  description: null,
  videoUrl: `https://example.com/${order}.mp4`,
  order,
  durationSec: 60
}));
const resources = [
  { id: 'r1', videoId: 'v2', title: 'LUT pack', description: null, fileUrl: '/f', fileType: 'zip' }
];
const progress = (done: string[]) =>
  new Map(done.map(id => [id, { progressPercent: 100, isCompleted: true }]));

describe('buildLessons', () => {
  it('opens only the first lesson for a new student', () => {
    const lessons = buildLessons({ videos, resources, progressByVideo: progress([]), hasAccess: true, freePreviewFirstLesson: false });
    assert.deepEqual(lessons.map(l => l.isLocked), [false, true, true]);
  });

  it('unlocks each lesson once every earlier one is complete', () => {
    const lessons = buildLessons({ videos, resources, progressByVideo: progress(['v1']), hasAccess: true, freePreviewFirstLesson: false });
    assert.deepEqual(lessons.map(l => l.isLocked), [false, false, true]);
  });

  it('keeps later lessons locked when an earlier one was skipped', () => {
    const lessons = buildLessons({ videos, resources, progressByVideo: progress(['v2']), hasAccess: true, freePreviewFirstLesson: false });
    assert.deepEqual(lessons.map(l => l.isLocked), [false, true, true]);
  });

  it('never leaks a video URL or resources for a locked lesson', () => {
    const lessons = buildLessons({ videos, resources, progressByVideo: progress([]), hasAccess: false, freePreviewFirstLesson: false });
    assert.ok(lessons.every(l => l.videoUrl === null && l.resources.length === 0));
  });

  it('opens only the first lesson as a free preview without access', () => {
    const lessons = buildLessons({ videos, resources, progressByVideo: progress([]), hasAccess: false, freePreviewFirstLesson: true });
    assert.deepEqual(lessons.map(l => l.isLocked), [false, true, true]);
  });

  it('lets admins review every lesson', () => {
    const lessons = buildLessons({ videos, resources, progressByVideo: progress([]), hasAccess: true, freePreviewFirstLesson: false, unlockAll: true });
    assert.ok(lessons.every(l => !l.isLocked));
    assert.equal(lessons[1].resources.length, 1);
  });

  it('reports progress and the next lesson to watch', () => {
    const lessons = buildLessons({ videos, resources, progressByVideo: progress(['v1']), hasAccess: true, freePreviewFirstLesson: false });
    assert.deepEqual(courseProgress(lessons), { total: 3, completed: 1, percent: 33, nextLessonId: 'v2' });
  });
});
