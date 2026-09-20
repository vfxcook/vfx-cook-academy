import { useState, type FormEvent } from 'react';
import { Link, useLoaderData, type LoaderFunctionArgs } from 'react-router';
import { Avatar, EmptyState, Field, Notice } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { formatRelative } from '../lib/format';
import type { CommunityPost, ReactionType } from '../lib/types';
import '../styles/community.css';

export async function communityLoader({ params }: LoaderFunctionArgs) {
  const detail = await api.courses.detail(params.slug!);
  const { posts } = await api.community.posts(detail.course.id);
  return { course: detail.course, access: detail.access, posts };
}

const REACTION_LABEL: Record<ReactionType, string> = {
  LIKE: '♥',
  FIRE: '🔥',
  CLAP: '👏'
};

function Composer({ courseId, onPosted }: { courseId: string; onPosted: (post: CommunityPost) => void }) {
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.set('courseId', courseId);
      body.set('title', title.trim());
      body.set('caption', caption.trim());
      if (file) body.set('mediaFile', file);

      const { post } = await api.community.createPost(body);
      onPosted(post);
      setTitle('');
      setCaption('');
      setFile(null);
      setPreview(null);
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
          placeholder="Night market — lesson 04 exercise"
        />
      </Field>

      <Field label="What are you after?" htmlFor="post-caption" hint="Ask for the notes you want.">
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
          onChange={event => {
            const picked = event.target.files?.[0] ?? null;
            setFile(picked);
            // Object URLs are revoked as soon as they are replaced, so previews never leak.
            setPreview(current => {
              if (current) URL.revokeObjectURL(current);
              return picked ? URL.createObjectURL(picked) : null;
            });
          }}
        />
      </Field>

      {preview ? (
        <div className="ac-media-frame wall-preview">
          <img src={preview} alt="Preview of the still you are about to post" />
        </div>
      ) : null}

      <div className="ac-row" style={{ justifyContent: 'flex-end' }}>
        <button type="submit" className="ac-btn ac-btn--primary" disabled={busy}>
          {busy ? 'Posting…' : 'Post to the wall'}
        </button>
      </div>
    </form>
  );
}

function Post({
  post,
  onRemoved
}: {
  post: CommunityPost;
  onRemoved: (id: string) => void;
}) {
  const [reactions, setReactions] = useState(post.reactions);
  const [comments, setComments] = useState(post.comments);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const react = async (type: ReactionType) => {
    const before = reactions;
    setReactions(current =>
      current.map(item =>
        item.type === type
          ? { ...item, mine: !item.mine, count: item.count + (item.mine ? -1 : 1) }
          : item
      )
    );
    try {
      await api.community.react({ postId: post.id, type });
    } catch {
      setReactions(before);
    }
  };

  const comment = async (event: FormEvent) => {
    event.preventDefault();
    const content = reply.trim();
    if (content.length < 2) return;

    setBusy(true);
    try {
      const result = await api.community.comment({ postId: post.id, content });
      setComments(current => [...current, result.comment]);
      setReply('');
    } catch {
      // The composer keeps the text so it can be retried.
    } finally {
      setBusy(false);
    }
  };

  const topLevel = comments.filter(item => !item.parentId);

  return (
    <article className="ac-panel wall-post">
      <header className="wall-post-head">
        <Avatar name={post.author.name} src={post.author.image} />
        <div>
          <strong>{post.author.name}</strong>
          <time dateTime={post.createdAt}>{formatRelative(post.createdAt)}</time>
        </div>
        {post.isMine ? (
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
        <a className="ac-media-frame wall-post-media" href={post.mediaUrl} target="_blank" rel="noreferrer noopener">
          <img src={post.mediaUrl} alt={post.title} loading="lazy" />
        </a>
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
                <strong>{item.author.name}</strong>
                <time dateTime={item.createdAt}>{formatRelative(item.createdAt)}</time>
                <p>{item.content}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <form className="wall-reply" onSubmit={comment}>
        <input
          className="ac-input"
          value={reply}
          maxLength={800}
          onChange={event => setReply(event.target.value)}
          placeholder="Leave a note…"
          aria-label={`Comment on ${post.title}`}
        />
        <button type="submit" className="ac-btn ac-btn--ghost ac-btn--sm" disabled={busy || reply.trim().length < 2}>
          {busy ? '…' : 'Send'}
        </button>
      </form>
    </article>
  );
}

export default function Community() {
  const { course, access, posts: initial } = useLoaderData<typeof communityLoader>();
  const [posts, setPosts] = useState(initial);

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
          {posts.length === 0 ? (
            <EmptyState title="Nothing on the wall yet">
              Be the first to post a frame. The batch gets a notification when you do.
            </EmptyState>
          ) : (
            posts.map(post => (
              <Post
                key={post.id}
                post={post}
                onRemoved={id => setPosts(current => current.filter(item => item.id !== id))}
              />
            ))
          )}
        </div>

        <aside className="wall-side">
          {access.hasAccess ? (
            <Composer
              courseId={course.id}
              onPosted={post => setPosts(current => [post, ...current])}
            />
          ) : (
            <Notice>Enrol in this course to post your work and join the notes.</Notice>
          )}
        </aside>
      </div>
    </div>
  );
}
