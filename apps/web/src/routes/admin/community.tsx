import { useState } from 'react';
import { Link, useLoaderData, useRevalidator } from 'react-router';
import { EmptyState, Notice } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { formatRelative, formatTimecode } from '../../lib/format';

export async function adminCommunityLoader() {
  return api.admin.community();
}

type Tab = 'doubts' | 'posts';

export default function AdminCommunity() {
  const { doubts, posts } = useLoaderData<typeof adminCommunityLoader>();
  const revalidator = useRevalidator();

  const [tab, setTab] = useState<Tab>('doubts');
  const [error, setError] = useState('');

  const remove = async (kind: Tab, id: string) => {
    setError('');
    try {
      if (kind === 'doubts') await api.comments.remove(id);
      else await api.community.removePost(id);
      revalidator.revalidate();
    } catch (thrown) {
      setError(errorMessage(thrown, 'Could not remove that.'));
    }
  };

  return (
    <>
      <div className="page-head" style={{ paddingTop: 0 }}>
        <p className="ac-eyebrow">Admin</p>
        <h1>Community</h1>
        <p className="ac-lede">The latest lesson doubts and wall posts across every course.</p>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="ac-row" role="tablist" aria-label="Community view">
        {(
          [
            ['doubts', `Lesson doubts (${doubts.length})`],
            ['posts', `Wall posts (${posts.length})`]
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`ac-btn ac-btn--sm ${tab === id ? 'ac-btn--ghost' : 'ac-btn--quiet'}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="ac-panel adm-card">
        {tab === 'doubts' ? (
          doubts.length === 0 ? (
            <EmptyState title="No doubts yet">Timestamped questions from the classroom land here.</EmptyState>
          ) : (
            <div className="ac-table-wrap">
              <table className="ac-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Lesson</th>
                    <th>At</th>
                    <th>Question</th>
                    <th>When</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {doubts.map(doubt => (
                    <tr key={doubt.id}>
                      <td>
                        {doubt.user.name ?? '—'}
                        <div className="adm-mini">{doubt.user.email}</div>
                      </td>
                      <td>
                        <Link to={`/learn/${doubt.video.course.slug}`}>{doubt.video.title}</Link>
                        <div className="adm-mini">{doubt.video.course.title}</div>
                      </td>
                      <td className="ac-mono">{formatTimecode(doubt.timestamp)}</td>
                      <td style={{ maxWidth: 360 }}>{doubt.text}</td>
                      <td>{formatRelative(doubt.createdAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="ac-btn ac-btn--quiet ac-btn--sm"
                          onClick={() => remove('doubts', doubt.id)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : posts.length === 0 ? (
          <EmptyState title="No posts yet">Student work shared on course walls lands here.</EmptyState>
        ) : (
          <div className="ac-table-wrap">
            <table className="ac-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Post</th>
                  <th>Course</th>
                  <th>Activity</th>
                  <th>When</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {posts.map(post => (
                  <tr key={post.id}>
                    <td>
                      {post.user.name ?? '—'}
                      <div className="adm-mini">{post.user.email}</div>
                    </td>
                    <td style={{ maxWidth: 320 }}>
                      <strong style={{ fontWeight: 600 }}>{post.title}</strong>
                      <div className="adm-mini">{post.caption.slice(0, 140)}</div>
                    </td>
                    <td>
                      <Link to={`/learn/${post.course.slug}/community`}>{post.course.title}</Link>
                    </td>
                    <td className="adm-mini">
                      {post._count.comments} notes · {post._count.reactions} reactions
                    </td>
                    <td>{formatRelative(post.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="ac-btn ac-btn--quiet ac-btn--sm"
                        onClick={() => remove('posts', post.id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
