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
  };
};

export function TimestampComments({
  videoId,
  initialComments,
}: {
  videoId: string;
  initialComments: CommentRow[];
}) {
  const [comments, setComments] = useState(initialComments);
  const [text, setText] = useState("");
  const [timestamp, setTimestamp] = useState(0);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const sortedComments = useMemo(
    () => [...comments].sort((a, b) => a.timestamp - b.timestamp),
    [comments],
  );

  async function submitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const response = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, timestamp, text }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Could not add comment.");
      setLoading(false);
      return;
    }

    setComments((prev) => [
      ...prev,
      {
        id: data.comment.id,
        timestamp: data.comment.timestamp,
        text: data.comment.text,
        createdAt: data.comment.createdAt,
        user: {
          name: data.comment.user.name,
          email: data.comment.user.email,
        },
      },
    ]);
    setText("");
    setLoading(false);
  }

  return (
    <section className="card" style={{ display: "grid", gap: "0.75rem" }}>
      <h3 style={{ margin: 0 }}>Timeline Comments</h3>
      <form onSubmit={submitComment} style={{ display: "grid", gap: "0.6rem" }}>
        <label style={{ display: "grid", gap: "0.35rem" }}>
          Timestamp (seconds)
          <input
            className="input"
            type="number"
            min={0}
            value={timestamp}
            onChange={(event) => setTimestamp(Number(event.target.value))}
            required
          />
        </label>
        <textarea
          className="textarea"
          rows={3}
          required
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="What did you learn at this timestamp?"
        />
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Posting..." : "Post comment"}
        </button>
        <p className="muted" style={{ margin: 0 }}>
          Tip: pause video, note second, add your learning/comment.
        </p>
      </form>
      {message ? <p className="muted" style={{ margin: 0 }}>{message}</p> : null}
      <div style={{ display: "grid", gap: "0.6rem" }}>
        {sortedComments.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No comments yet.
          </p>
        ) : (
          sortedComments.map((comment) => (
            <div key={comment.id} style={{ borderTop: "1px solid #26365b", paddingTop: "0.6rem" }}>
              <strong>{formatTimestamp(comment.timestamp)}</strong> - {comment.text}
              <p className="muted" style={{ margin: "0.25rem 0 0" }}>
                {comment.user.name ?? comment.user.email ?? "Learner"}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
