"use client";

import { useMemo, useState } from "react";

import { formatTimestamp } from "@/lib/utils";

type CommentRow = {
  id: string;
  timestamp: number;
  text: string;
  createdAt: string;
  user: {
    name: string | null;
    email: string | null;
    image?: string | null;
  };
};

type VideoRow = {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string;
  order: number;
  durationSec: number;
  comments: CommentRow[];
};

type CourseResourceRow = {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string;
  fileType: string;
  videoId?: string | null;
};

type LeaderboardRow = {
  userLabel: string;
  completedLessons: number;
  totalLessons: number;
  progressPercent: number;
};

function toProtectedEmbedUrl(url: string) {
  if (!url) return url;
  if (url.includes("vimeo.com")) {
    let videoId = "";
    if (url.includes("player.vimeo.com/video/")) {
      videoId = url.split("player.vimeo.com/video/")[1]?.split("?")[0] ?? "";
    } else {
      const match = url.match(/vimeo\.com\/(\d+)/);
      videoId = match?.[1] ?? "";
    }
    if (!videoId) return url;
    return `https://player.vimeo.com/video/${videoId}?title=0&byline=0&portrait=0&speed=0&dnt=1`;
  }

  if (!url.includes("youtube.com") && !url.includes("youtu.be")) return url;
  let videoId = "";
  if (url.includes("/embed/")) {
    videoId = url.split("/embed/")[1]?.split("?")[0] ?? "";
  } else if (url.includes("watch?v=")) {
    videoId = url.split("watch?v=")[1]?.split("&")[0] ?? "";
  } else if (url.includes("youtu.be/")) {
    videoId = url.split("youtu.be/")[1]?.split("?")[0] ?? "";
  }
  if (!videoId) return url;
  return `https://www.youtube-nocookie.com/embed/${videoId}?modestbranding=1&rel=0&iv_load_policy=3&disablekb=1&fs=0&playsinline=1`;
}

export function ClassroomPlayer({
  courseTitle,
  videos,
  completedVideoIds,
  resources = [],
  leaderboardRows = [],
}: {
  courseTitle: string;
  videos: VideoRow[];
  completedVideoIds: string[];
  resources?: CourseResourceRow[];
  leaderboardRows?: LeaderboardRow[];
}) {
  const [activeTab, setActiveTab] = useState<"community" | "classroom" | "leaderboard">(
    "community",
  );
  const [communityTab, setCommunityTab] = useState<
    "feed" | "ask" | "showcase" | "challenge" | "leaderboard"
  >("feed");
  const [activeVideoId, setActiveVideoId] = useState(videos[0]?.id ?? "");
  const [completedIds, setCompletedIds] = useState(completedVideoIds);
  const [commentText, setCommentText] = useState("");
  const [commentTimestamp, setCommentTimestamp] = useState(263);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const orderedVideos = useMemo(() => [...videos].sort((a, b) => a.order - b.order), [videos]);
  const activeVideo = useMemo(
    () => orderedVideos.find((video) => video.id === activeVideoId) ?? orderedVideos[0],
    [activeVideoId, orderedVideos],
  );
  const communityFeed = useMemo(
    () =>
      orderedVideos
        .flatMap((video) =>
          video.comments.map((comment) => ({
            ...comment,
            videoTitle: video.title,
            videoOrder: video.order,
          })),
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [orderedVideos],
  );

  if (!activeVideo) return null;

  let contiguousCompletedCount = 0;
  for (const video of orderedVideos) {
    if (completedIds.includes(video.id)) contiguousCompletedCount += 1;
    else break;
  }
  const unlockedVideoIds = new Set(
    orderedVideos.slice(0, Math.min(orderedVideos.length, contiguousCompletedCount + 1)).map((v) => v.id),
  );
  const isActiveVideoUnlocked = unlockedVideoIds.has(activeVideo.id);
  const isCompleted = completedIds.includes(activeVideo.id);
  const activeVideoResources = resources.filter((resource) => resource.videoId === activeVideo.id);
  const progressPercent =
    orderedVideos.length > 0 ? Math.round((completedIds.length / orderedVideos.length) * 100) : 0;

  async function markComplete() {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: activeVideo.id, progressPercent: 100, isCompleted: true }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Could not save progress.");
      setSaving(false);
      return;
    }
    if (!completedIds.includes(activeVideo.id)) {
      setCompletedIds((prev) => [...prev, activeVideo.id]);
    }
    setMessage("Lesson marked complete.");
    setSaving(false);
  }

  async function postComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoId: activeVideo.id,
        timestamp: commentTimestamp,
        text: commentText,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Could not post doubt.");
      setSaving(false);
      return;
    }
    setCommentText("");
    setMessage("Posted to community feed.");
    setSaving(false);
    window.location.reload();
  }

  const navBtn = (selected: boolean): React.CSSProperties => ({
    borderRadius: 999,
    border: `1px solid ${selected ? "#5f84ff" : "#2b3a62"}`,
    background: selected
      ? "linear-gradient(120deg, rgba(70,108,255,0.42), rgba(133,90,255,0.28))"
      : "rgba(14,23,39,0.7)",
    color: "#e9efff",
    minHeight: 38,
    padding: "0.45rem 0.9rem",
    fontSize: "0.83rem",
  });

  return (
    <div style={{ display: "grid", gap: "0.8rem" }}>
      <section
        className="card"
        style={{
          background:
            "linear-gradient(100deg, rgba(7,16,31,0.92), rgba(15,33,72,0.88), rgba(9,15,33,0.92)), url('https://images.unsplash.com/photo-1485841890310-6a055c88698a?auto=format&fit=crop&w=1600&q=80') center/cover",
          borderColor: "#324b7f",
          padding: "1rem 1.1rem",
        }}
      >
        <span className="muted" style={{ fontSize: "0.72rem", fontWeight: 700 }}>
          MALAYALAM BATCH
        </span>
        <h1 style={{ margin: "0.25rem 0 0.4rem", fontSize: "2.1rem" }}>AI Video Creation Masterclass</h1>
        <p className="muted" style={{ marginTop: 0, maxWidth: 700 }}>
          Learn cinematic AI workflows through weekly lessons, real project breakdowns, doubts, and
          creator challenges.
        </p>
        <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
          {["36M+ Views", "July 13 Batch", "Weekly New Lessons", "Community Feedback"].map((chip) => (
            <span
              key={chip}
              style={{
                borderRadius: 999,
                border: "1px solid #516ca3",
                background: "rgba(11,20,36,0.8)",
                padding: "0.32rem 0.6rem",
                fontSize: "0.78rem",
                fontWeight: 700,
              }}
            >
              {chip}
            </span>
          ))}
        </div>
      </section>

      <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
        <button className="btn" style={navBtn(activeTab === "community")} onClick={() => setActiveTab("community")}>
          Community
        </button>
        <button className="btn" style={navBtn(activeTab === "classroom")} onClick={() => setActiveTab("classroom")}>
          Classroom
        </button>
        <button
          className="btn"
          style={navBtn(activeTab === "leaderboard")}
          onClick={() => setActiveTab("leaderboard")}
        >
          Leaderboard
        </button>
      </div>

      {activeTab === "community" ? (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 315px", gap: "0.75rem" }}>
          <section className="card" style={{ background: "rgba(7,13,26,0.9)", borderColor: "#283a60" }}>
            <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              {[
                { id: "feed", label: "Community Feed" },
                { id: "ask", label: "Ask Doubt" },
                { id: "showcase", label: "Student Showcase" },
                { id: "challenge", label: "Weekly Challenge" },
                { id: "leaderboard", label: "Leaderboard" },
              ].map((item) => (
                <button
                  key={item.id}
                  className="btn"
                  style={navBtn(communityTab === item.id)}
                  onClick={() =>
                    setCommunityTab(item.id as "feed" | "ask" | "showcase" | "challenge" | "leaderboard")
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>

            {(communityTab === "ask" || communityTab === "feed") && (
              <div className="card" style={{ background: "rgba(15,24,44,0.75)", borderColor: "#385181", marginBottom: "0.75rem" }}>
                <h3 style={{ marginTop: 0 }}>Ask a Doubt</h3>
                <form onSubmit={postComment} style={{ display: "grid", gap: "0.45rem" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: "0.45rem" }}>
                    <select
                      className="select"
                      value={activeVideoId}
                      onChange={(event) => setActiveVideoId(event.target.value)}
                    >
                      {orderedVideos.map((video) => (
                        <option key={video.id} value={video.id}>
                          Lesson {video.order} - {video.title}
                        </option>
                      ))}
                    </select>
                    <input
                      className="input"
                      value={commentTimestamp}
                      onChange={(event) => setCommentTimestamp(Number(event.target.value))}
                      type="number"
                      min={0}
                      placeholder="04:23"
                    />
                  </div>
                  <textarea
                    className="textarea"
                    rows={3}
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    placeholder="At 04:23, why is my character face changing during camera movement?"
                    required
                  />
                  <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                    <button type="button" className="btn btn-secondary">
                      Attach Output
                    </button>
                    <button type="button" className="btn btn-secondary">
                      Add Timestamp
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      Post Doubt
                    </button>
                  </div>
                </form>
                {message ? <p className="muted">{message}</p> : null}
              </div>
            )}

            {communityTab === "feed" && (
              <div style={{ display: "grid", gap: "0.6rem" }}>
                {communityFeed.map((comment, index) => (
                  <article
                    key={comment.id}
                    className="card"
                    style={{ background: "#0e1a34", borderColor: "#2d426f", display: "grid", gap: "0.32rem" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong>{comment.user.name ?? comment.user.email ?? "Student"}</strong>
                      <span className="muted">{index % 2 === 0 ? "Mentor Answered" : "New"}</span>
                    </div>
                    <span className="muted">
                      Lesson {comment.videoOrder} - {comment.videoTitle} • {formatTimestamp(comment.timestamp)}
                    </span>
                    <p style={{ margin: 0 }}>{comment.text}</p>
                    <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                      <span className="muted">{(index % 4) + 1} replies</span>
                      <button className="btn btn-secondary" type="button">
                        View Answer
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {communityTab === "showcase" && (
              <article className="card" style={{ background: "#0e1a34", borderColor: "#2d426f" }}>
                <strong>Sneha shared an AI ad shot</strong>
                <p className="muted">Created this using product lighting workflow from Module 2.</p>
                <div
                  style={{
                    height: 170,
                    borderRadius: 10,
                    background:
                      "linear-gradient(120deg,rgba(84,120,255,.35),rgba(160,95,255,.32)), url('https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80') center/cover",
                    border: "1px solid #3b4f7a",
                  }}
                />
                <div style={{ display: "flex", gap: "0.45rem", marginTop: "0.6rem" }}>
                  <button className="btn btn-secondary">Give Feedback</button>
                  <button className="btn btn-secondary">View Prompt</button>
                </div>
              </article>
            )}

            {communityTab === "challenge" && (
              <article className="card" style={{ background: "#0e1a34", borderColor: "#2d426f" }}>
                <h3 style={{ marginTop: 0 }}>This Week&apos;s Challenge</h3>
                <p className="muted">Create a 5-second cinematic AI ad shot using one product image.</p>
                <button className="btn btn-primary">Join Challenge</button>
              </article>
            )}

            {communityTab === "leaderboard" && (
              <div style={{ display: "grid", gap: "0.45rem" }}>
                {leaderboardRows.map((row, idx) => (
                  <div key={row.userLabel + idx} className="card" style={{ background: "#0f1830", borderColor: "#2e3f66" }}>
                    <strong>
                      #{idx + 1} {row.userLabel}
                    </strong>
                    <p className="muted" style={{ margin: "0.3rem 0 0" }}>
                      {row.completedLessons}/{row.totalLessons} lessons • {row.progressPercent}%
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="card" style={{ background: "rgba(7,13,26,0.9)", borderColor: "#283a60" }}>
            <h3 style={{ marginTop: 0 }}>This Week&apos;s Challenge</h3>
            <p className="muted">Create a 5-second cinematic AI ad shot using one product image.</p>
            <button className="btn btn-primary">Join Challenge</button>
            <div style={{ borderTop: "1px solid #223454", marginTop: "0.8rem", paddingTop: "0.75rem" }}>
              <h4 style={{ marginTop: 0 }}>Top Contributors</h4>
              <p className="muted" style={{ margin: 0 }}>Arjun K. • Sneha M. • Vishnu P.</p>
            </div>
            <div style={{ borderTop: "1px solid #223454", marginTop: "0.8rem", paddingTop: "0.75rem" }}>
              <h4 style={{ marginTop: 0 }}>Upcoming Live Session</h4>
              <p className="muted" style={{ margin: 0 }}>Sunday, 8:00 PM - Prompt Breakdown + Doubt Solving</p>
            </div>
            <div style={{ borderTop: "1px solid #223454", marginTop: "0.8rem", paddingTop: "0.75rem" }}>
              <h4 style={{ marginTop: 0 }}>Pinned Resources</h4>
              <div style={{ display: "grid", gap: "0.35rem" }}>
                {resources.slice(0, 5).map((resource) => (
                  <a key={resource.id} href={resource.fileUrl} className="muted" target="_blank" rel="noreferrer">
                    {resource.title}
                  </a>
                ))}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {activeTab === "classroom" ? (
        <div style={{ display: "grid", gridTemplateColumns: "285px minmax(0,1fr)", gap: "0.75rem" }}>
          <aside className="card" style={{ background: "rgba(7,13,26,0.9)", borderColor: "#283a60" }}>
            <h3 style={{ marginTop: 0 }}>{courseTitle}</h3>
            <div style={{ height: 9, borderRadius: 999, overflow: "hidden", background: "#1d2a43", marginBottom: "0.4rem" }}>
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: "100%",
                  background: "linear-gradient(90deg,#1dcf8e,#0fa46f)",
                }}
              />
            </div>
            <p className="muted" style={{ marginTop: 0 }}>
              {progressPercent}% complete
            </p>
            <div style={{ display: "grid", gap: "0.4rem" }}>
              {orderedVideos.map((video) => {
                const unlocked = unlockedVideoIds.has(video.id);
                return (
                  <button
                    key={video.id}
                    className="btn"
                    style={{
                      justifyContent: "space-between",
                      textAlign: "left",
                      borderColor: video.id === activeVideo.id ? "#5c82ff" : "#2d426c",
                      background: video.id === activeVideo.id ? "rgba(244,213,127,.93)" : "#131d31",
                      color: video.id === activeVideo.id ? "#111" : "#e8efff",
                      opacity: unlocked ? 1 : 0.58,
                      cursor: unlocked ? "pointer" : "not-allowed",
                    }}
                    onClick={() => unlocked && setActiveVideoId(video.id)}
                    disabled={!unlocked}
                  >
                    <span>
                      L{video.order} - {video.title}
                    </span>
                    <span>{completedIds.includes(video.id) ? "✅" : unlocked ? "•" : "🔒"}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="card" style={{ background: "rgba(7,13,26,0.9)", borderColor: "#283a60" }}>
            <h2 style={{ marginTop: 0 }}>
              L{activeVideo.order} - {activeVideo.title}
            </h2>
            <div style={{ position: "relative", width: "100%", paddingTop: "56.25%" }}>
              <iframe
                src={toProtectedEmbedUrl(activeVideo.videoUrl)}
                title={activeVideo.title}
                allowFullScreen
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  borderRadius: 12,
                  border: "1px solid #2d426c",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.7rem", flexWrap: "wrap" }}>
              <button className="btn btn-primary" onClick={markComplete} disabled={saving || !isActiveVideoUnlocked}>
                {saving ? "Saving..." : isCompleted ? "Completed" : "Mark Completed"}
              </button>
              <span className="muted">
                {activeVideo.durationSec > 0 ? `${Math.ceil(activeVideo.durationSec / 60)} min` : ""}
              </span>
              {!isActiveVideoUnlocked ? <span className="muted">Finish previous lesson first.</span> : null}
            </div>
            <p className="muted">{activeVideo.description ?? "Detailed lesson notes."}</p>
            <div style={{ marginTop: "0.7rem", display: "grid", gap: "0.45rem" }}>
              <h3 style={{ margin: 0 }}>Lesson Resources</h3>
              {activeVideoResources.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>
                  No downloadable resources attached for this lesson yet.
                </p>
              ) : (
                activeVideoResources.map((resource) => (
                  <a
                    key={resource.id}
                    href={resource.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="muted"
                  >
                    {resource.title} ({resource.fileType.toUpperCase()})
                  </a>
                ))
              )}
            </div>

            <div style={{ marginTop: "1rem", borderTop: "1px solid #263b66", paddingTop: "0.8rem" }}>
              <h3 style={{ marginTop: 0 }}>Comments</h3>
              <form onSubmit={postComment} style={{ display: "grid", gap: "0.45rem", marginBottom: "0.8rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "0.45rem" }}>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={commentTimestamp}
                    onChange={(event) => setCommentTimestamp(Number(event.target.value))}
                    placeholder="04:23"
                    required
                  />
                  <input
                    className="input"
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    placeholder="Write a comment..."
                    required
                  />
                </div>
                <div style={{ display: "flex", gap: "0.45rem" }}>
                  <button className="btn btn-primary" type="submit" disabled={saving}>
                    Post Comment
                  </button>
                  <span className="muted">Timestamp auto-attached to comment</span>
                </div>
                {message ? <p className="muted" style={{ margin: 0 }}>{message}</p> : null}
              </form>

              <div style={{ display: "grid", gap: "0.6rem" }}>
                {activeVideo.comments.length === 0 ? (
                  <p className="muted" style={{ margin: 0 }}>
                    No comments yet on this lesson.
                  </p>
                ) : (
                  activeVideo.comments.map((comment) => (
                    <article
                      key={comment.id}
                      style={{
                        borderTop: "1px solid #223457",
                        paddingTop: "0.55rem",
                        display: "grid",
                        gridTemplateColumns: "36px 1fr",
                        gap: "0.55rem",
                      }}
                    >
                      {comment.user.image ? (
                        <img
                          src={comment.user.image}
                          alt={comment.user.name ?? "User"}
                          style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            background: "#243a67",
                            display: "grid",
                            placeItems: "center",
                            fontWeight: 700,
                            fontSize: "0.75rem",
                          }}
                        >
                          {(comment.user.name ?? comment.user.email ?? "U").slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div style={{ display: "flex", gap: "0.45rem", alignItems: "center", flexWrap: "wrap" }}>
                          <strong>{comment.user.name ?? comment.user.email ?? "Learner"}</strong>
                          <span className="muted">{formatTimestamp(comment.timestamp)}</span>
                        </div>
                        <p style={{ margin: "0.22rem 0 0" }}>{comment.text}</p>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "leaderboard" ? (
        <section className="card" style={{ background: "rgba(7,13,26,0.9)", borderColor: "#283a60" }}>
          <h2 style={{ marginTop: 0 }}>Leaderboard</h2>
          <div style={{ display: "grid", gap: "0.45rem" }}>
            {leaderboardRows.map((row, idx) => (
              <div key={row.userLabel + idx} className="card" style={{ background: "#0f1830", borderColor: "#2e3f66" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>
                    #{idx + 1} {row.userLabel}
                  </strong>
                  <span>{row.progressPercent}%</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
