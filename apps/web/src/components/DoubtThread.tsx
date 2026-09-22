import { useState } from 'react';
import { Link } from 'react-router';
import { api, errorMessage } from '../lib/api';
import { formatRelative, formatTimecode } from '../lib/format';
import type { TimestampComment } from '../lib/types';
import { embedAtTimestamp, resolveVideo } from '../lib/video';
import { Avatar, Notice } from './ui';

interface DoubtThreadProps {
  lessonId: string;
  videoUrl: string | null;
  comments: TimestampComment[];
  canPost: boolean;
  signedIn: boolean;
  courseSlug: string;
  currentTime: () => number;
  onSeek: (seconds: number) => void;
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill={filled ? 'currentColor' : 'none'} aria-hidden="true">
      <path
        d="M7 12.2S1.6 9 1.6 5.3A2.9 2.9 0 0 1 7 3.8a2.9 2.9 0 0 1 5.4 1.5C12.4 9 7 12.2 7 12.2Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Composer({
  placeholder,
  submitLabel,
  timestamp,
  onCancel,
  onSubmit
}: {
  placeholder: string;
  submitLabel: string;
  timestamp?: number;
  onCancel?: () => void;
  onSubmit: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  return (
    <form
      className="ac-stack"
      style={{ gap: 10 }}
      onSubmit={async event => {
        event.preventDefault();
        const value = text.trim();
        if (value.length < 2) {
          setError('Write a little more so people can help.');
          return;
        }
        setBusy(true);
        setError('');
        try {
          await onSubmit(value);
          setText('');
        } catch (thrown) {
          setError(errorMessage(thrown, 'Could not post that.'));
        } finally {
          setBusy(false);
        }
      }}
    >
      {timestamp !== undefined ? (
        <span className="doubt-at">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="5.6" stroke="currentColor" strokeWidth="1.3" />
            <path d="M7 4v3.2l2 1.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          Posting at {formatTimecode(timestamp)}
        </span>
      ) : null}

      <textarea
        className="ac-textarea"
        style={{ minHeight: 78 }}
        placeholder={placeholder}
        value={text}
        maxLength={400}
        onChange={event => setText(event.target.value)}
      />

      {error ? <span className="ac-error">{error}</span> : null}

      <div className="ac-row" style={{ justifyContent: 'flex-end' }}>
        {onCancel ? (
          <button type="button" className="ac-btn ac-btn--quiet ac-btn--sm" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button type="submit" className="ac-btn ac-btn--primary ac-btn--sm" disabled={busy}>
          {busy ? 'Posting…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Doubt({
  comment,
  canPost,
  canSeek,
  externalLink,
  onSeek,
  onReply,
  onDelete
}: {
  comment: TimestampComment;
  canPost: boolean;
  canSeek: boolean;
  externalLink: string | null;
  onSeek: (seconds: number) => void;
  onReply: (parentId: string, text: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [replying, setReplying] = useState(false);
  const [liked, setLiked] = useState(comment.likedByMe);
  const [likes, setLikes] = useState(comment.likeCount);

  const stamp = formatTimecode(comment.timestamp);

  return (
    <article className="doubt">
      <Avatar name={comment.author.name} src={comment.author.image} size="sm" />

      <div className="doubt-body">
        <div className="doubt-meta">
          <strong>{comment.author.name}</strong>
          {canSeek ? (
            <button type="button" className="doubt-seek" onClick={() => onSeek(comment.timestamp)}>
              {stamp}
            </button>
          ) : externalLink ? (
            <a className="doubt-seek" href={externalLink} target="_blank" rel="noreferrer noopener">
              {stamp}
            </a>
          ) : (
            <span className="doubt-seek">{stamp}</span>
          )}
          <time dateTime={comment.createdAt}>{formatRelative(comment.createdAt)}</time>
        </div>

        <p className="doubt-text">{comment.text}</p>

        <div className="doubt-tools">
          <button
            type="button"
            className="doubt-tool"
            data-active={liked || undefined}
            aria-label={liked ? 'Remove like' : 'Like this'}
            onClick={async () => {
              const next = !liked;
              setLiked(next);
              setLikes(count => count + (next ? 1 : -1));
              try {
                const result = await api.comments.like(comment.id);
                setLiked(result.liked);
                setLikes(result.likeCount);
              } catch {
                setLiked(!next);
                setLikes(count => count + (next ? -1 : 1));
              }
            }}
          >
            <HeartIcon filled={liked} />
            {likes > 0 ? likes : ''}
          </button>

          {canPost ? (
            <button type="button" className="doubt-tool" onClick={() => setReplying(value => !value)}>
              Reply
            </button>
          ) : null}

          {comment.canDelete ? (
            <button type="button" className="doubt-tool" onClick={() => void onDelete(comment.id)}>
              Delete
            </button>
          ) : null}
        </div>

        {replying ? (
          <Composer
            placeholder={`Reply to ${comment.author.name}…`}
            submitLabel="Reply"
            onCancel={() => setReplying(false)}
            onSubmit={async text => {
              await onReply(comment.id, text);
              setReplying(false);
            }}
          />
        ) : null}

        {comment.replies.length > 0 ? (
          <div className="doubt-replies">
            {comment.replies.map(reply => (
              <Doubt
                key={reply.id}
                comment={reply}
                canPost={false}
                canSeek={canSeek}
                externalLink={externalLink}
                onSeek={onSeek}
                onReply={onReply}
                onDelete={onDelete}
              />
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export default function DoubtThread({
  lessonId,
  videoUrl,
  comments: initial,
  canPost,
  signedIn,
  courseSlug,
  currentTime,
  onSeek
}: DoubtThreadProps) {
  const [comments, setComments] = useState(initial);
  const [error, setError] = useState('');

  const source = videoUrl ? resolveVideo(videoUrl) : null;
  const canSeek = source?.kind === 'file';

  const addReply = async (parentId: string, text: string) => {
    const { comment } = await api.comments.create({
      videoId: lessonId,
      parentId,
      timestamp: currentTime(),
      text
    });
    setComments(current =>
      current.map(item =>
        item.id === parentId ? { ...item, replies: [...item.replies, comment] } : item
      )
    );
  };

  const remove = async (id: string) => {
    try {
      await api.comments.remove(id);
      setComments(current =>
        current
          .filter(item => item.id !== id)
          .map(item => ({ ...item, replies: item.replies.filter(reply => reply.id !== id) }))
      );
    } catch (thrown) {
      setError(errorMessage(thrown, 'Could not delete that comment.'));
    }
  };

  return (
    <section className="doubts" aria-labelledby="doubts-heading">
      <div className="ac-between" style={{ flexWrap: 'wrap' }}>
        <div>
          <p className="ac-eyebrow">Doubts &amp; notes</p>
          <h2 id="doubts-heading" className="ac-title" style={{ fontSize: 21 }}>
            {comments.length === 0
              ? 'No questions on this lesson yet'
              : `${comments.length} ${comments.length === 1 ? 'thread' : 'threads'}`}
          </h2>
        </div>
      </div>

      {canPost ? (
        <div className="ac-panel doubt-composer">
          <Composer
            placeholder="Ask about a specific moment — we pin it to the current timecode."
            submitLabel="Post doubt"
            timestamp={undefined}
            onSubmit={async text => {
              const timestamp = currentTime();
              const { comment } = await api.comments.create({
                videoId: lessonId,
                timestamp,
                text
              });
              setComments(current =>
                [...current, comment].sort((a, b) => a.timestamp - b.timestamp)
              );
            }}
          />
          <p className="ac-hint">
            {canSeek
              ? 'Your doubt is stamped at wherever the player is paused, so replies land in context.'
              : 'Mention the timecode in your question — this lesson streams from a hosted player, so we cannot read the playhead.'}
          </p>
        </div>
      ) : (
        <Notice>
          {signedIn ? (
            <>
              <Link to={`/courses/${courseSlug}`}>Enrol in this course</Link> to ask questions and
              reply to the batch.
            </>
          ) : (
            <>
              <Link to={`/sign-in?next=${encodeURIComponent(`/courses/${courseSlug}`)}`}>Sign in</Link>{' '}
              and enrol to ask questions and reply to the batch.
            </>
          )}
        </Notice>
      )}

      {error ? <Notice tone="error">{error}</Notice> : null}

      <div>
        {comments.map(comment => (
          <Doubt
            key={comment.id}
            comment={comment}
            canPost={canPost}
            canSeek={canSeek}
            externalLink={source ? embedAtTimestamp(source, comment.timestamp) : null}
            onSeek={onSeek}
            onReply={addReply}
            onDelete={remove}
          />
        ))}
      </div>
    </section>
  );
}
