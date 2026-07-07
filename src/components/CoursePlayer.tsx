"use client";

import { useMemo, useState } from "react";

type VideoRow = {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string;
  order: number;
  durationSec: number;
};

export function CoursePlayer({
  videos,
  completedVideoIds,
}: {
  videos: VideoRow[];
  completedVideoIds: string[];
}) {
  const [activeVideoId, setActiveVideoId] = useState(videos[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const activeVideo = useMemo(
    () => videos.find((video) => video.id === activeVideoId) ?? videos[0],
    [activeVideoId, videos],
  );

  if (!activeVideo) {
    return null;
  }

  const isCompleted = completedVideoIds.includes(activeVideo.id);

  async function markComplete() {
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoId: activeVideo.id,
        progressPercent: 100,
        isCompleted: true,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Could not save progress.");
      setLoading(false);
      return;
    }
    setMessage("Progress saved.");
    setLoading(false);
    window.location.reload();
  }

  return (
    <section style={{ display: "grid", gap: "1rem" }}>
      <article className="card" style={{ display: "grid", gap: "0.75rem" }}>
        <h2 style={{ margin: 0 }}>{activeVideo.title}</h2>
        <p className="muted" style={{ margin: 0 }}>
          {activeVideo.description ?? "Start learning now."}
        </p>
        <div style={{ position: "relative", width: "100%", paddingTop: "56.25%" }}>
          <iframe
            src={activeVideo.videoUrl}
            title={activeVideo.title}
            allowFullScreen
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              borderRadius: 10,
              border: "1px solid #223152",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn btn-primary" type="button" onClick={markComplete} disabled={loading}>
            {loading ? "Saving..." : isCompleted ? "Completed" : "Mark as completed"}
          </button>
          {message ? <span className="muted">{message}</span> : null}
        </div>
      </article>

      <article className="card" style={{ display: "grid", gap: "0.5rem" }}>
        <h3 style={{ margin: 0 }}>Course Lessons</h3>
        {videos.map((video) => (
          <button
            key={video.id}
            type="button"
            className="btn btn-secondary"
            style={{
              textAlign: "left",
              border: video.id === activeVideo.id ? "1px solid #4c6fff" : "1px solid transparent",
            }}
            onClick={() => setActiveVideoId(video.id)}
          >
            {video.order}. {video.title} {completedVideoIds.includes(video.id) ? "✓" : ""}
          </button>
        ))}
      </article>
    </section>
  );
}
