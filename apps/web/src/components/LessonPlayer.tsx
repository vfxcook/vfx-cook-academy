import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { api } from '../lib/api';
import { resolveVideo } from '../lib/video';

export interface PlayerHandle {
  seekTo: (seconds: number) => void;
  currentTime: () => number;
}

interface LessonPlayerProps {
  lessonId: string;
  title: string;
  videoUrl: string;
  isCompleted: boolean;
  onProgress: (percent: number, isCompleted: boolean) => void;
}

const SAVE_EVERY_MS = 15_000;
const COMPLETE_AT = 0.95;

/**
 * Plays an uploaded file in a real <video> so comments can scrub to a timestamp and
 * progress saves itself; hosted URLs fall back to an embed, where progress is marked
 * by hand. Saves are throttled and one final save is flushed on unmount.
 */
const LessonPlayer = forwardRef<PlayerHandle, LessonPlayerProps>(function LessonPlayer(
  { lessonId, title, videoUrl, isCompleted, onProgress },
  ref
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSavedAt = useRef(0);
  const latest = useRef({ percent: 0, completed: isCompleted });
  const [source] = useState(() => resolveVideo(videoUrl));

  useImperativeHandle(ref, () => ({
    seekTo(seconds) {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = seconds;
      void video.play().catch(() => undefined);
      video.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    currentTime() {
      return Math.floor(videoRef.current?.currentTime ?? 0);
    }
  }));

  const save = async (percent: number, completed: boolean) => {
    try {
      await api.courses.saveProgress({
        videoId: lessonId,
        progressPercent: Math.round(percent),
        isCompleted: completed
      });
      onProgress(Math.round(percent), completed);
    } catch {
      // Progress is a convenience; a failed save must never interrupt playback.
    }
  };

  useEffect(() => {
    latest.current = { percent: 0, completed: isCompleted };
    lastSavedAt.current = 0;
  }, [lessonId, isCompleted]);

  // One flush on unmount so leaving mid-lesson still records where they got to.
  useEffect(
    () => () => {
      const { percent, completed } = latest.current;
      if (percent > 0) void save(percent, completed);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lessonId]
  );

  if (source.kind === 'file') {
    return (
      <div className="ac-media-frame room-screen">
        <video
          ref={videoRef}
          src={source.src}
          title={title}
          controls
          playsInline
          controlsList="nodownload"
          onContextMenu={event => event.preventDefault()}
          onTimeUpdate={event => {
            const video = event.currentTarget;
            if (!video.duration || Number.isNaN(video.duration)) return;

            const ratio = video.currentTime / video.duration;
            const percent = Math.min(100, Math.round(ratio * 100));
            const completed = latest.current.completed || ratio >= COMPLETE_AT;
            latest.current = { percent, completed };

            const now = Date.now();
            if (now - lastSavedAt.current < SAVE_EVERY_MS) return;
            lastSavedAt.current = now;
            void save(percent, completed);
          }}
          onEnded={() => {
            latest.current = { percent: 100, completed: true };
            void save(100, true);
          }}
        />
      </div>
    );
  }

  return (
    <div className="ac-media-frame room-screen">
      <iframe
        src={source.embed}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
});

export default LessonPlayer;
