import Link from "next/link";

import { formatCompactDate, getAdminCommunity } from "@/lib/admin-data";

export default async function AdminCommunityPage() {
  const comments = await getAdminCommunity();

  return (
    <section className="card admin-operating-section">
      <div className="admin-section-heading">
        <div>
          <p>Community</p>
          <h2>Recent Doubts</h2>
        </div>
        <span className="admin-count-pill">{comments.length} items</span>
      </div>

      <div className="admin-community-list">
        {comments.length === 0 ? (
          <p className="muted">No recent doubts.</p>
        ) : (
          comments.map((comment) => (
            <article key={comment.id} className="admin-doubt-row">
              <div>
                <strong>{comment.user.name ?? comment.user.email ?? "Student"}</strong>
                <p className="muted">
                  {comment.video.course.title} - L{comment.video.order} - {comment.video.title} - {formatCompactDate(comment.createdAt)}
                </p>
                <p>{comment.text.slice(0, 180)}</p>
              </div>
              <div className="admin-doubt-actions">
                <span className="admin-badge-published">New</span>
                <Link className="btn btn-secondary" href={`/course/${comment.video.course.slug}`}>
                  Open Course
                </Link>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
