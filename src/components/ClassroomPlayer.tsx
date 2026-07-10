"use client";

import { useEffect, useMemo, useState } from "react";

import { formatTimestamp } from "@/lib/utils";

type CommentRow = {
  id: string;
  timestamp: number;
  text: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  canDelete: boolean;
  user: {
    name: string | null;
    email: string | null;
    image?: string | null;
  };
  replies: CommentRow[];
};

type VideoRow = {
  id: string;
  title: string;
  description: string | null;
  descriptionHtml?: string | null;
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

type CommunityReactionType = "LIKE" | "FIRE" | "CLAP";

type CommunityUser = {
  id: string;
  name: string | null;
  email: string | null;
  image?: string | null;
};

type CommunityPostComment = {
  id: string;
  postId: string;
  parentId: string | null;
  content: string;
  createdAt: string;
  user: CommunityUser;
};

type CommunityPost = {
  id: string;
  title: string;
  caption: string;
  mediaUrl: string | null;
  createdAt: string;
  userId: string;
  user: CommunityUser;
  reactions: Array<{ type: CommunityReactionType; userId: string }>;
  comments: CommunityPostComment[];
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
  courseId,
  currentUserId,
  hasFullAccess,
  previewFirstLessonOnly,
  checkoutHref,
  courseTitle,
  videos,
  completedVideoIds,
  resources = [],
  leaderboardRows = [],
}: {
  courseId: string;
  currentUserId: string;
  hasFullAccess: boolean;
  previewFirstLessonOnly: boolean;
  checkoutHref: string;
  courseTitle: string;
  videos: VideoRow[];
  completedVideoIds: string[];
  resources?: CourseResourceRow[];
  leaderboardRows?: LeaderboardRow[];
}) {
  const [activeTab, setActiveTab] = useState<"community" | "classroom" | "leaderboard">(
    "classroom",
  );
  const [communityTab, setCommunityTab] = useState<"feed" | "ask" | "showcase" | "leaderboard">(
    "feed",
  );
  const [activeVideoId, setActiveVideoId] = useState(videos[0]?.id ?? "");
  const [completedIds, setCompletedIds] = useState(completedVideoIds);
  const [commentText, setCommentText] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityMessage, setCommunityMessage] = useState("");
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostCaption, setNewPostCaption] = useState("");
  const [newPostMediaUrl, setNewPostMediaUrl] = useState("");
  const [newPostImageFile, setNewPostImageFile] = useState<File | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [postCommentDrafts, setPostCommentDrafts] = useState<Record<string, string>>({});
  const [postReplyDrafts, setPostReplyDrafts] = useState<Record<string, string>>({});
  const [feedSort, setFeedSort] = useState<"latest" | "top">("latest");
  const [imageModalUrl, setImageModalUrl] = useState<string | null>(null);

  const orderedVideos = useMemo(() => [...videos].sort((a, b) => a.order - b.order), [videos]);
  const activeVideo = useMemo(
    () => orderedVideos.find((video) => video.id === activeVideoId) ?? orderedVideos[0],
    [activeVideoId, orderedVideos],
  );
  if (!activeVideo) return null;

  async function loadCommunityPosts() {
    setCommunityLoading(true);
    setCommunityMessage("");
    try {
      const response = await fetch(`/api/community/posts?courseId=${encodeURIComponent(courseId)}`);
      const data = (await response.json()) as { posts?: CommunityPost[]; error?: string };
      if (!response.ok) {
        setCommunityMessage(data.error ?? "Could not load community posts.");
        setCommunityLoading(false);
        return;
      }
      setCommunityPosts(data.posts ?? []);
    } catch (_error) {
      setCommunityMessage("Could not load community posts.");
    } finally {
      setCommunityLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "community") {
      void loadCommunityPosts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, courseId]);

  let unlockedVideoIds = new Set<string>();
  if (previewFirstLessonOnly && orderedVideos[0]) {
    unlockedVideoIds = new Set([orderedVideos[0].id]);
  } else {
    let contiguousCompletedCount = 0;
    for (const video of orderedVideos) {
      if (completedIds.includes(video.id)) contiguousCompletedCount += 1;
      else break;
    }
    unlockedVideoIds = new Set(
      orderedVideos.slice(0, Math.min(orderedVideos.length, contiguousCompletedCount + 1)).map((v) => v.id),
    );
  }
  const isActiveVideoUnlocked = unlockedVideoIds.has(activeVideo.id);
  const isCompleted = completedIds.includes(activeVideo.id);
  const activeVideoResources = resources.filter((resource) => resource.videoId === activeVideo.id);
  const progressPercent =
    orderedVideos.length > 0 ? Math.round((completedIds.length / orderedVideos.length) * 100) : 0;
  const sortedCommunityPosts = useMemo(() => {
    const posts = [...communityPosts];
    if (feedSort === "top") {
      posts.sort(
        (a, b) =>
          b.reactions.length - a.reactions.length ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      return posts;
    }
    posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return posts;
  }, [communityPosts, feedSort]);

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

  async function postComment(event: React.FormEvent<HTMLFormElement>, parentId?: string) {
    event.preventDefault();
    const text = (parentId ? replyDrafts[parentId] : commentText)?.trim();
    if (!text) return;
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoId: activeVideo.id,
        parentId,
        timestamp: 0,
        text,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Could not post doubt.");
      setSaving(false);
      return;
    }
    if (parentId) {
      setReplyDrafts((prev) => ({ ...prev, [parentId]: "" }));
    } else {
      setCommentText("");
    }
    setMessage(parentId ? "Reply posted." : "Comment posted.");
    setSaving(false);
    window.location.reload();
  }

  async function likeLessonComment(commentId: string) {
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/comments/${commentId}/like`, { method: "POST" });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(data.error ?? "Could not update like.");
      setSaving(false);
      return;
    }
    window.location.reload();
  }

  async function deleteLessonComment(commentId: string) {
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/comments/${commentId}`, { method: "DELETE" });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(data.error ?? "Could not delete comment.");
      setSaving(false);
      return;
    }
    window.location.reload();
  }

  async function createCommunityPost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newPostTitle.trim() || !newPostCaption.trim()) return;
    setCommunityLoading(true);
    setCommunityMessage("");
    try {
      const formData = new FormData();
      formData.append("courseId", courseId);
      formData.append("title", newPostTitle.trim());
      formData.append("caption", newPostCaption.trim());
      formData.append("mediaUrl", newPostMediaUrl.trim());
      if (newPostImageFile) {
        formData.append("mediaFile", newPostImageFile);
      }
      const response = await fetch("/api/community/posts", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as { post?: CommunityPost; error?: string };
      if (!response.ok || !data.post) {
        setCommunityMessage(data.error ?? "Could not submit creation.");
        setCommunityLoading(false);
        return;
      }
      setCommunityPosts((prev) => [data.post!, ...prev]);
      setNewPostTitle("");
      setNewPostCaption("");
      setNewPostMediaUrl("");
      setNewPostImageFile(null);
      setCommunityMessage("Creation shared to community.");
    } catch (_error) {
      setCommunityMessage("Could not submit creation.");
    } finally {
      setCommunityLoading(false);
    }
  }

  async function reactToPost(postId: string, type: CommunityReactionType) {
    const response = await fetch("/api/community/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, type }),
    });
    const data = (await response.json()) as { active?: boolean; error?: string };
    if (!response.ok) {
      setCommunityMessage(data.error ?? "Could not react to post.");
      return;
    }
    setCommunityPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) return post;
        const hasReaction = post.reactions.some((item) => item.userId === currentUserId && item.type === type);
        return {
          ...post,
          reactions: hasReaction
            ? post.reactions.filter((item) => !(item.userId === currentUserId && item.type === type))
            : [...post.reactions, { userId: currentUserId, type }],
        };
      }),
    );
  }

  async function addPostComment(postId: string, parentId?: string) {
    const sourceKey = parentId ? `${postId}:${parentId}` : postId;
    const content = (parentId ? postReplyDrafts[sourceKey] : postCommentDrafts[sourceKey])?.trim();
    if (!content) return;
    const response = await fetch("/api/community/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, parentId, content }),
    });
    const data = (await response.json()) as { comment?: CommunityPostComment; error?: string };
    if (!response.ok || !data.comment) {
      setCommunityMessage(data.error ?? "Could not post comment.");
      return;
    }
    setCommunityPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              comments: [...post.comments, data.comment!],
            }
          : post,
      ),
    );
    if (parentId) {
      setPostReplyDrafts((prev) => ({ ...prev, [sourceKey]: "" }));
    } else {
      setPostCommentDrafts((prev) => ({ ...prev, [sourceKey]: "" }));
    }
  }

  function renderLessonComment(comment: CommentRow, isReply = false) {
    const userLabel = comment.user.name ?? comment.user.email ?? "Learner";
    const initial = userLabel.slice(0, 1).toUpperCase();

    return (
      <article key={comment.id} className={isReply ? "lesson-reply-row" : "lesson-comment-card"}>
        {comment.user.image ? (
          <img
            src={comment.user.image}
            alt={userLabel}
            className="lesson-comment-avatar"
          />
        ) : (
          <div className="lesson-comment-avatar lesson-comment-avatar-fallback">{initial}</div>
        )}
        <div className="lesson-comment-body">
          <div className="lesson-comment-meta">
            <strong>{userLabel}</strong>
            {comment.timestamp > 0 ? <span className="muted">{formatTimestamp(comment.timestamp)}</span> : null}
          </div>
          <p className="lesson-comment-text">{comment.text}</p>
          <div className="lesson-comment-actions">
            <button
              className="btn btn-secondary lesson-comment-action"
              type="button"
              onClick={() => likeLessonComment(comment.id)}
              disabled={saving}
            >
              {comment.likedByMe ? "Liked" : "Like"} {comment.likeCount > 0 ? comment.likeCount : ""}
            </button>
            {!isReply ? <span className="muted">Reply</span> : null}
            {comment.canDelete ? (
              <button
                className="btn btn-secondary lesson-comment-action danger"
                type="button"
                onClick={() => deleteLessonComment(comment.id)}
                disabled={saving}
              >
                Delete
              </button>
            ) : null}
          </div>
          {!isReply ? (
            <form className="lesson-reply-form" onSubmit={(event) => postComment(event, comment.id)}>
              <input
                className="input"
                value={replyDrafts[comment.id] ?? ""}
                onChange={(event) =>
                  setReplyDrafts((prev) => ({ ...prev, [comment.id]: event.target.value }))
                }
                placeholder="Reply to this comment..."
              />
              <button className="btn btn-secondary" type="submit" disabled={saving}>
                Reply
              </button>
            </form>
          ) : null}
          {!isReply && comment.replies.length > 0 ? (
            <div className="lesson-replies">{comment.replies.map((reply) => renderLessonComment(reply, true))}</div>
          ) : null}
        </div>
      </article>
    );
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
        className="card classroom-intro-card"
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

      <div className="classroom-tab-row" style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
        <button className="btn" style={navBtn(activeTab === "classroom")} onClick={() => setActiveTab("classroom")}>
          Classroom
        </button>
        <button className="btn" style={navBtn(activeTab === "community")} onClick={() => setActiveTab("community")}>
          Community
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
        <div className="classroom-community-layout" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 315px", gap: "0.75rem" }}>
          <section className="card" style={{ background: "rgba(7,13,26,0.9)", borderColor: "#283a60" }}>
            <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              {[
                { id: "feed", label: "Community Feed" },
                { id: "ask", label: "Ask Doubt" },
                { id: "showcase", label: "Student Showcase" },
                { id: "leaderboard", label: "Leaderboard" },
              ].map((item) => (
                <button
                  key={item.id}
                  className="btn"
                  style={navBtn(communityTab === item.id)}
                  onClick={() => setCommunityTab(item.id as "feed" | "ask" | "showcase" | "leaderboard")}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {(communityTab === "ask" || communityTab === "feed") && (
              <div className="card" style={{ background: "rgba(15,24,44,0.75)", borderColor: "#385181", marginBottom: "0.75rem" }}>
                <h3 style={{ marginTop: 0 }}>Ask a Doubt</h3>
                <form onSubmit={postComment} style={{ display: "grid", gap: "0.45rem" }}>
                  <div style={{ display: "grid", gap: "0.45rem" }}>
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
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    style={{ borderColor: feedSort === "latest" ? "#5c82ff" : undefined }}
                    onClick={() => setFeedSort("latest")}
                  >
                    Latest
                  </button>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    style={{ borderColor: feedSort === "top" ? "#5c82ff" : undefined }}
                    onClick={() => setFeedSort("top")}
                  >
                    Most Liked
                  </button>
                </div>
                {communityLoading ? <p className="muted">Loading community posts...</p> : null}
                {communityMessage ? (
                  <p className="muted" style={{ margin: 0 }}>
                    {communityMessage}
                  </p>
                ) : null}
                {!communityLoading && communityPosts.length === 0 ? (
                  <p className="muted">No community creations yet. Be the first one to post.</p>
                ) : null}
                {sortedCommunityPosts.map((post) => {
                  const topLevelComments = post.comments.filter((comment) => !comment.parentId);
                  const reactionCount = (type: CommunityReactionType) =>
                    post.reactions.filter((reaction) => reaction.type === type).length;
                  const myReactionTypes = new Set(
                    post.reactions
                      .filter((reaction) => reaction.userId === currentUserId)
                      .map((reaction) => reaction.type),
                  );
                  return (
                    <article
                      key={post.id}
                      className="card"
                      style={{ background: "#0e1a34", borderColor: "#2d426f", display: "grid", gap: "0.45rem" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                        <strong>{post.user.name ?? post.user.email ?? "Student"}</strong>
                        <span className="muted">
                          {new Date(post.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <h4 style={{ margin: 0 }}>{post.title}</h4>
                      <p style={{ margin: 0 }}>{post.caption}</p>
                      {post.mediaUrl ? (
                        /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(post.mediaUrl) ||
                        post.mediaUrl.includes("/community/") ? (
                          <img
                            src={post.mediaUrl}
                            alt={post.title}
                            style={{
                              width: "100%",
                              maxHeight: 340,
                              objectFit: "cover",
                              borderRadius: 10,
                              border: "1px solid #2d426f",
                              cursor: "zoom-in",
                            }}
                            onClick={() => setImageModalUrl(post.mediaUrl!)}
                          />
                        ) : (
                          <a href={post.mediaUrl} target="_blank" rel="noreferrer" className="muted">
                            View attached creation
                          </a>
                        )
                      ) : null}
                      <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                        {(
                          [
                            { type: "LIKE", emoji: "👍" },
                            { type: "FIRE", emoji: "🔥" },
                            { type: "CLAP", emoji: "👏" },
                          ] as const
                        ).map((reaction) => (
                          <button
                            key={reaction.type}
                            className="btn btn-secondary"
                            type="button"
                            style={{
                              borderColor: myReactionTypes.has(reaction.type) ? "#5c82ff" : undefined,
                            }}
                            onClick={() => reactToPost(post.id, reaction.type)}
                          >
                            {reaction.emoji} {reactionCount(reaction.type)}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: "grid", gap: "0.45rem", borderTop: "1px solid #24395f", paddingTop: "0.55rem" }}>
                        {topLevelComments.map((comment) => {
                          const replies = post.comments.filter((item) => item.parentId === comment.id);
                          return (
                            <div key={comment.id} style={{ display: "grid", gap: "0.35rem" }}>
                              <p style={{ margin: 0 }}>
                                <strong>{comment.user.name ?? comment.user.email ?? "Student"}:</strong>{" "}
                                {comment.content}
                              </p>
                              {replies.map((reply) => (
                                <p key={reply.id} className="muted" style={{ margin: 0, paddingLeft: "0.9rem" }}>
                                  ↳ <strong>{reply.user.name ?? reply.user.email ?? "Student"}:</strong>{" "}
                                  {reply.content}
                                </p>
                              ))}
                              <div style={{ display: "flex", gap: "0.35rem" }}>
                                <input
                                  className="input"
                                  value={postReplyDrafts[`${post.id}:${comment.id}`] ?? ""}
                                  onChange={(event) =>
                                    setPostReplyDrafts((prev) => ({
                                      ...prev,
                                      [`${post.id}:${comment.id}`]: event.target.value,
                                    }))
                                  }
                                  placeholder="Reply..."
                                />
                                <button
                                  className="btn btn-secondary"
                                  type="button"
                                  onClick={() => addPostComment(post.id, comment.id)}
                                >
                                  Reply
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        <div style={{ display: "flex", gap: "0.35rem" }}>
                          <input
                            className="input"
                            value={postCommentDrafts[post.id] ?? ""}
                            onChange={(event) =>
                              setPostCommentDrafts((prev) => ({ ...prev, [post.id]: event.target.value }))
                            }
                            placeholder="Add comment..."
                          />
                          <button className="btn btn-secondary" type="button" onClick={() => addPostComment(post.id)}>
                            Comment
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {communityTab === "showcase" && (
              <article className="card" style={{ background: "#0e1a34", borderColor: "#2d426f" }}>
                <h3 style={{ marginTop: 0 }}>Share Your Creation</h3>
                <form onSubmit={createCommunityPost} style={{ display: "grid", gap: "0.45rem" }}>
                  <input
                    className="input"
                    value={newPostTitle}
                    onChange={(event) => setNewPostTitle(event.target.value)}
                    placeholder="Title (e.g. Car Commercial Shot in Rain)"
                    required
                  />
                  <textarea
                    className="textarea"
                    rows={3}
                    value={newPostCaption}
                    onChange={(event) => setNewPostCaption(event.target.value)}
                    placeholder="What workflow did you use and where do you want feedback?"
                    required
                  />
                  <input
                    className="input"
                    value={newPostMediaUrl}
                    onChange={(event) => setNewPostMediaUrl(event.target.value)}
                    placeholder="Optional media link (Drive/Vimeo/YouTube)"
                  />
                  <input
                    className="input"
                    type="file"
                    accept="image/*"
                    onChange={(event) => setNewPostImageFile(event.target.files?.[0] ?? null)}
                  />
                  <button className="btn btn-primary" type="submit" disabled={communityLoading}>
                    {communityLoading ? "Publishing..." : "Publish Creation"}
                  </button>
                </form>
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
            <h3 style={{ marginTop: 0 }}>Community Signals</h3>
            <p className="muted">Live community updates based on real posts and discussions.</p>
            <div style={{ borderTop: "1px solid #223454", marginTop: "0.8rem", paddingTop: "0.75rem" }}>
              <h4 style={{ marginTop: 0 }}>Top Contributors</h4>
              {leaderboardRows.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>
                  No contributor data yet.
                </p>
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  {leaderboardRows
                    .slice(0, 3)
                    .map((row) => row.userLabel)
                    .join(" • ")}
                </p>
              )}
            </div>
            <div style={{ borderTop: "1px solid #223454", marginTop: "0.8rem", paddingTop: "0.75rem" }}>
              <h4 style={{ marginTop: 0 }}>Total Creations Shared</h4>
              <p className="muted" style={{ margin: 0 }}>{communityPosts.length}</p>
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
        <div className="classroom-layout" style={{ display: "grid", gridTemplateColumns: "285px minmax(0,1fr)", gap: "0.75rem" }}>
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
                      cursor: unlocked || previewFirstLessonOnly ? "pointer" : "not-allowed",
                    }}
                    onClick={() => (unlocked || previewFirstLessonOnly) && setActiveVideoId(video.id)}
                    disabled={!unlocked && !previewFirstLessonOnly}
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
            {isActiveVideoUnlocked ? (
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
            ) : (
              <div
                className="card"
                style={{
                  borderColor: "#3f2f4f",
                  background: "linear-gradient(160deg, rgba(22,15,30,0.95), rgba(13,11,22,0.95))",
                  display: "grid",
                  gap: "0.6rem",
                }}
              >
                <h3 style={{ margin: 0 }}>This lesson is locked</h3>
                <p className="muted" style={{ margin: 0 }}>
                  The first lesson is free. Buy the course to unlock Lesson {activeVideo.order} and all
                  remaining lessons.
                </p>
                <a className="btn btn-primary" href={checkoutHref}>
                  Buy Course Now
                </a>
              </div>
            )}
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.7rem", flexWrap: "wrap" }}>
              <button
                className="btn btn-primary"
                onClick={markComplete}
                disabled={saving || !isActiveVideoUnlocked || !hasFullAccess}
              >
                {saving ? "Saving..." : isCompleted ? "Completed" : "Mark Completed"}
              </button>
              <span className="muted">
                {activeVideo.durationSec > 0 ? `${Math.ceil(activeVideo.durationSec / 60)} min` : ""}
              </span>
              {!isActiveVideoUnlocked ? (
                <span className="muted">
                  {previewFirstLessonOnly
                    ? "Buy course now to unlock this lesson."
                    : "Finish previous lesson first."}
                </span>
              ) : null}
            </div>
            {activeVideo.descriptionHtml ? (
              <div className="lesson-richtext" dangerouslySetInnerHTML={{ __html: activeVideo.descriptionHtml }} />
            ) : (
              <p className="muted">{activeVideo.description ?? "Detailed lesson notes."}</p>
            )}
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
                <div style={{ display: "grid", gap: "0.45rem" }}>
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
                </div>
                {message ? <p className="muted" style={{ margin: 0 }}>{message}</p> : null}
              </form>

              <div className="lesson-comments-list">
                {activeVideo.comments.length === 0 ? (
                  <p className="muted" style={{ margin: 0 }}>
                    No comments yet on this lesson.
                  </p>
                ) : (
                  activeVideo.comments.map((comment) => renderLessonComment(comment))
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

      {imageModalUrl ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2,6,14,0.82)",
            zIndex: 120,
            display: "grid",
            placeItems: "center",
            padding: "1rem",
          }}
          onClick={() => setImageModalUrl(null)}
        >
          <img
            src={imageModalUrl}
            alt="Student creation preview"
            style={{
              maxWidth: "min(1100px, 96vw)",
              maxHeight: "90vh",
              borderRadius: 12,
              border: "1px solid #3c5386",
              boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
            }}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}
