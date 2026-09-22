import { useMemo, useState, type FormEvent } from 'react';
import { Link, useLoaderData, type LoaderFunctionArgs } from 'react-router';
import { Avatar, Dialog, EmptyState, Field, Meter, Notice } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { formatRelative } from '../lib/format';
import type { CommunityComment, CommunityPost, Leaderboard, ReactionType } from '../lib/types';
import '../styles/community.css';

export async function communityLoader({ params }: LoaderFunctionArgs) {
  const detail = await api.courses.detail(params.slug!);
  const [{ posts }, leaderboard] = await Promise.all([
    api.community.posts(detail.course.id),
    api.courses.leaderboard(params.slug!).catch((): Leaderboard => ({ rows: [], myRank: null }))
  ]);
  return { course: detail.course, access: detail.access, posts, leaderboard };
}

const REACTION_LABEL: Record<ReactionType, string> = { LIKE: '♥', FIRE: '🔥', CLAP: '👏' };

const IMAGE_URL = /(\.(png|jpe?g|gif|webp|avif)(\?|#|$))|\/uploads\/|\/storage\/v1\/object\//i;
const isImage = (url: string) => IMAGE_URL.test(url);

type Sort = 'latest' | 'top';

function Composer({ courseId, onPosted }: { courseId: string; onPosted: (post: CommunityPost) => void }) {
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = (picked: File | null) => {
    setFile(picked);
    // Object URLs are revoked as soon as they are replaced, so previews never leak.
    setPreview(current => {
      if (current) URL.revokeObjectURL(current);
      return picked ? URL.createObjectURL(picked) : null;
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.set('courseId', courseId);
      body.set('title', title.trim());
      body.set('caption', caption.trim());
      if (mediaUrl.trim()) body.set('mediaUrl', mediaUrl.trim());
      if (file) body.set('mediaFile', file);

      const { post } = await api.community.createPost(body);
      onPosted(post);
      setTitle('');
      setCaption('');
      setMediaUrl('');
      pick(null);
    } catch (thrown) {
      setError(errorMessage(thrown, 'Could not post that.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="ac-panel wall-composer" onSubmit={submit}>
      <div>
        <p className="ac-eyebrow">Post your work</p>
        <h2 className="ac-title" style={{ fontSize: 20, marginTop: 6 }}>
          Show the batch what you made
        </h2>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <Field label="Title" htmlFor="post-title">
        <input
          id="post-title"
          className="ac-input"
          required
          minLength={2}
          maxLength={140}
          value={title}
          onChange={event => setTitle(event.target.value)}
          placeholder="Car commercial shot in the rain"
        />
      </Field>

      <Field label="Workflow & what you want notes on" htmlFor="post-caption">
        <textarea
          id="post-caption"
          className="ac-textarea"
          required
          minLength={2}
          maxLength={1500}
          value={caption}
          onChange={event => setCaption(event.target.value)}
          placeholder="Struggling to keep the key light consistent across the three shots…"
        />
      </Field>

      <Field label="Still or frame" htmlFor="post-media" hint="Images only, up to 6MB.">
        <input
          id="post-media"
          className="ac-input"
          type="file"
          accept="image/*"
          onChange={event => pick(event.target.files?.[0] ?? null)}
        />
      </Field>

      {preview ? (
        <div className="ac-media-frame wall-preview">
          <img src={preview} alt="Preview of the still you are about to post" />
        </div>
      ) : null}

      <Field label="Or a link" htmlFor="post-link" hint="Drive, Vimeo or YouTube. Optional.">
        <input
          id="post-link"
          className="ac-input"
          type="url"
          value={mediaUrl}
          onChange={event => setMediaUrl(event.target.value)}
          placeholder="https://vimeo.com/…"
        />
      </Field>

      <div className="ac-row" style={{ justifyContent: 'flex-end' }}>
        <button type="submit" className="ac-btn ac-btn--primary" disabled={busy}>
          {busy ? 'Posting…' : 'Post to the wall'}
        </button>
      </div>
    </form>
  );
}

function CommentBody({ comment }: { comment: CommunityComment }) {
  return (
    <>
      <strong>{comment.author.name}</strong>
      <time dateTime={comment.createdAt}>{formatRelative(comment.createdAt)}</time>
      <p>{comment.content}</p>
    </>
  );
}

function Post({
  post,
  onRemoved,
  onOpenImage
}: {
  post: CommunityPost;
  onRemoved: (id: string) => void;
  onOpenImage: (url: string, alt: string) => void;
}) {
  const [reactions, setReactions] = useState(post.reactions);
  const [comments, setComments] = useState(post.comments);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<CommunityComment | null>(null);
  const [busy, setBusy] = useState(false);

  const react = async (type: ReactionType) => {
    const before = reactions;
    setReactions(current =>
      current.map(item =>
        item.type === type ? { ...item, mine: !item.mine, count: item.count + (item.mine ? -1 : 1) } : item
      )
    );
    try {
      await api.community.react({ postId: post.id, type });
    } catch {
      setReactions(before);
    }
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (content.length < 2) return;

    setBusy(true);
    try {
      const result = await api.community.comment({
        postId: post.id,
        parentId: replyTo?.id,
        content
      });
      setComments(current => [...current, result.comment]);
      setDraft('');
      setReplyTo(null);
    } catch {
      // The draft stays in the box so it can be retried.
    } finally {
      setBusy(false);
    }
  };

  const topLevel = comments.filter(item => !item.parentId);
  const repliesTo = (id: string) => comments.filter(item => item.parentId === id);

  return (
    <article className="ac-panel wall-post">
      <header className="wall-post-head">
        <Avatar name={post.author.name} src={post.author.image} />
        <div>
          <strong>{post.author.name}</strong>
          <time dateTime={post.createdAt}>{formatRelative(post.createdAt)}</time>
        </div>
        {post.canDelete ? (
          <button
            type="button"
            className="ac-btn ac-btn--quiet ac-btn--sm"
            onClick={async () => {
              await api.community.removePost(post.id).catch(() => undefined);
              onRemoved(post.id);
            }}
          >
            Delete
          </button>
        ) : null}
      </header>

      <h3 className="wall-post-title">{post.title}</h3>
      <p className="wall-post-caption">{post.caption}</p>

      {post.mediaUrl ? (
        isImage(post.mediaUrl) ? (
          <button
            type="button"
            className="ac-media-frame wall-post-media"
            onClick={() => onOpenImage(post.mediaUrl!, post.title)}
            aria-label={`Open ${post.title} full size`}
          >
            <img src={post.mediaUrl} alt={post.title} loading="lazy" />
          </button>
        ) : (
          <a className="ac-chip wall-link" href={post.mediaUrl} target="_blank" rel="noreferrer noopener">
            Open the work ↗
          </a>
        )
      ) : null}

      <div className="wall-reactions">
        {reactions.map(reaction => (
          <button
            key={reaction.type}
            type="button"
            className="wall-reaction"
            data-active={reaction.mine || undefined}
            onClick={() => react(reaction.type)}
            aria-label={`${reaction.type.toLowerCase()} — ${reaction.count}`}
            aria-pressed={reaction.mine}
          >
            <span aria-hidden="true">{REACTION_LABEL[reaction.type]}</span>
            {reaction.count > 0 ? reaction.count : ''}
          </button>
        ))}
      </div>

      {topLevel.length > 0 ? (
        <div className="wall-comments">
          {topLevel.map(item => (
            <div key={item.id} className="wall-comment">
              <Avatar name={item.author.name} src={item.author.image} size="sm" />
              <div>
                <CommentBody comment={item} />
                <button type="button" className="wall-reply-btn" onClick={() => setReplyTo(item)}>
                  Reply
                </button>

                {repliesTo(item.id).length > 0 ? (
                  <div className="wall-replies">
                    {repliesTo(item.id).map(reply => (
                      <div key={reply.id} className="wall-comment">
                        <Avatar name={reply.author.name} src={reply.author.image} size="sm" />
                        <div>
                          <CommentBody comment={reply} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <form className="wall-reply" onSubmit={send}>
        {replyTo ? (
          <span className="wall-replying">
            Replying to {replyTo.author.name}
            <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply">
              ×
            </button>
          </span>
        ) : null}
        <div className="wall-reply-row">
          <input
            className="ac-input"
            value={draft}
            maxLength={800}
            onChange={event => setDraft(event.target.value)}
            placeholder={replyTo ? `Reply to ${replyTo.author.name}…` : 'Leave a note…'}
            aria-label={`Comment on ${post.title}`}
          />
          <button type="submit" className="ac-btn ac-btn--ghost ac-btn--sm" disabled={busy || draft.trim().length < 2}>
            {busy ? '…' : 'Send'}
          </button>
        </div>
      </form>
    </article>
  );
}

function LeaderboardPanel({ leaderboard }: { leaderboard: Leaderboard }) {
  if (leaderboard.rows.length === 0) return null;

  return (
    <section className="ac-panel wall-board" aria-labelledby="board-heading">
      <div className="ac-between">
        <p className="ac-eyebrow" id="board-heading">
          Leaderboard
        </p>
        {leaderboard.myRank ? <span className="ac-chip ac-chip--ember">You · #{leaderboard.myRank}</span> : null}
      </div>
      <ol className="wall-board-list">
        {leaderboard.rows.slice(0, 10).map((row, index) => (
          <li key={row.id} data-me={row.isMe || undefined}>
            <b>{String(index + 1).padStart(2, '0')}</b>
            <Avatar name={row.name} src={row.image} size="sm" />
            <span className="wall-board-body">
              <strong>{row.name}</strong>
              <Meter percent={row.percent} label={`${row.name} progress`} />
            </span>
            <small>
              {row.completedLessons}/{row.totalLessons}
            </small>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function Community() {
  const { course, access, posts: initial, leaderboard } = useLoaderData<typeof communityLoader>();
  const [posts, setPosts] = useState(initial);
  const [sort, setSort] = useState<Sort>('latest');
  const [lightbox, setLightbox] = useState<{ url: string; alt: string } | null>(null);

  const sorted = useMemo(() => {
    const list = [...posts];
    const score = (post: CommunityPost) => post.reactions.reduce((sum, item) => sum + item.count, 0);
    list.sort((a, b) =>
      sort === 'top'
        ? score(b) - score(a) || Date.parse(b.createdAt) - Date.parse(a.createdAt)
        : Date.parse(b.createdAt) - Date.parse(a.createdAt)
    );
    return list;
  }, [posts, sort]);

  return (
    <div className="ac-shell wall" style={{ paddingBottom: 'clamp(48px, 7vw, 88px)' }}>
      <div className="page-head">
        <p className="ac-eyebrow">Community wall</p>
        <h1>{course.title}</h1>
        <p className="ac-lede">
          Post a shot, ask for notes, and see what the rest of the batch is making.{' '}
          <Link to={`/learn/${course.slug}`}>Back to the lessons</Link>
        </p>
      </div>

      <div className="wall-grid">
        <div className="wall-feed">
          {posts.length > 1 ? (
            <div className="ac-row" role="tablist" aria-label="Sort posts">
              {(['latest', 'top'] as const).map(option => (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={sort === option}
                  className={`ac-btn ac-btn--sm ${sort === option ? 'ac-btn--ghost' : 'ac-btn--quiet'}`}
                  onClick={() => setSort(option)}
                >
                  {option === 'latest' ? 'Latest' : 'Most loved'}
                </button>
              ))}
            </div>
          ) : null}

          {sorted.length === 0 ? (
            <EmptyState title="Nothing on the wall yet">
              Be the first to post a frame. The batch gets a notification when you do.
            </EmptyState>
          ) : (
            sorted.map(post => (
              <Post
                key={post.id}
                post={post}
                onRemoved={id => setPosts(current => current.filter(item => item.id !== id))}
                onOpenImage={(url, alt) => setLightbox({ url, alt })}
              />
            ))
          )}
        </div>

        <aside className="wall-side">
          {access.hasAccess ? (
            <Composer courseId={course.id} onPosted={post => setPosts(current => [post, ...current])} />
          ) : (
            <Notice>Enrol in this course to post your work and join the notes.</Notice>
          )}
          <LeaderboardPanel leaderboard={leaderboard} />
        </aside>
      </div>

      {lightbox ? (
        <Dialog title={lightbox.alt} onClose={() => setLightbox(null)} wide>
          <img className="wall-lightbox" src={lightbox.url} alt={lightbox.alt} />
        </Dialog>
      ) : null}
    </div>
  );
}
