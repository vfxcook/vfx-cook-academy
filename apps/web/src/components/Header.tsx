import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router';
import { api } from '../lib/api';
import { brand } from '../lib/content';
import { forgetGoogleAccount } from '../lib/googleIdentity';
import { formatRelative } from '../lib/format';
import type { NotificationItem, User } from '../lib/types';
import { Avatar } from './ui';

function useDismissOnOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  return ref;
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useDismissOnOutside(open, () => setOpen(false));

  const load = async () => {
    try {
      const data = await api.notifications.list();
      setItems(data.items);
      setUnread(data.unreadCount);
    } catch {
      // A failed poll should never interrupt what someone is doing.
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const markAll = async () => {
    setUnread(0);
    setItems(current => current.map(item => ({ ...item, isRead: true })));
    await api.notifications.markAllRead().catch(() => undefined);
  };

  return (
    <div className="bell" ref={ref}>
      <button
        type="button"
        className="ac-btn ac-btn--ghost ac-btn--icon"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        onClick={() => {
          setOpen(value => !value);
          if (!open) void load();
        }}
      >
        <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path
            d="M9 2a5 5 0 0 0-5 5v3l-1.4 2.3A.5.5 0 0 0 3 13h12a.5.5 0 0 0 .4-.7L14 10V7a5 5 0 0 0-5-5Z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <path d="M7 15a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        {unread > 0 ? <span className="bell-dot">{unread > 9 ? '9+' : unread}</span> : null}
      </button>

      {open ? (
        <div className="ac-panel pop">
          <div className="ac-between" style={{ padding: '8px 10px 10px' }}>
            <span className="ac-eyebrow">Notifications</span>
            {unread > 0 ? (
              <button type="button" className="ac-btn ac-btn--quiet ac-btn--sm" onClick={markAll}>
                Mark all read
              </button>
            ) : null}
          </div>

          {items.length === 0 ? (
            <p className="ac-hint" style={{ padding: '14px 10px 18px' }}>
              Nothing yet. Replies, reactions and new lessons land here.
            </p>
          ) : (
            items.map(item => (
              <Link
                key={item.id}
                className="pop-item"
                data-unread={!item.isRead || undefined}
                to={
                  !item.course
                    ? '/dashboard'
                    : item.postId
                      ? `/learn/${item.course.slug}/community`
                      : `/learn/${item.course.slug}`
                }
                onClick={() => {
                  setOpen(false);
                  if (!item.isRead) {
                    setUnread(count => Math.max(0, count - 1));
                    void api.notifications.markRead(item.id).catch(() => undefined);
                  }
                }}
              >
                <Avatar name={item.actor?.name ?? 'Academy'} src={item.actor?.image} size="sm" />
                <span>
                  <strong>{item.title}</strong>
                  <span>{item.message}</span>
                  <time dateTime={item.createdAt}>{formatRelative(item.createdAt)}</time>
                </span>
              </Link>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function UserMenu({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const ref = useDismissOnOutside(open, () => setOpen(false));

  return (
    <div className="bell" ref={ref}>
      <button
        type="button"
        className="usr"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(value => !value)}
      >
        <Avatar name={user.name} src={user.image} size="sm" />
        <span className="usr-name">{user.name ?? 'Account'}</span>
      </button>

      {open ? (
        <div className="ac-panel pop menu" role="menu">
          <div className="menu-head">
            <strong>{user.name ?? 'Your account'}</strong>
            <span>{user.email}</span>
          </div>
          <hr />
          <Link to="/dashboard" role="menuitem" onClick={() => setOpen(false)}>
            My classroom
          </Link>
          <Link to="/studio" role="menuitem" onClick={() => setOpen(false)}>
            AI Studio
          </Link>
          <Link to="/profile" role="menuitem" onClick={() => setOpen(false)}>
            Profile &amp; settings
          </Link>
          {user.role === 'ADMIN' ? (
            <>
              <hr />
              <Link to="/admin" role="menuitem" onClick={() => setOpen(false)}>
                Admin workspace
              </Link>
            </>
          ) : null}
          <hr />
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              await api.auth.signOut().catch(() => undefined);
              forgetGoogleAccount();
              // A full navigation drops every loader result that still holds the old session.
              window.location.assign('/');
            }}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function Header({ user }: { user: User | null }) {
  return (
    <header className="hdr">
      <div className="hdr-inner">
        <Link className="hdr-brand" to="/" aria-label={`${brand.name} ${brand.module} — home`}>
          <img src="/brand/logo-mark.png" alt="" width={21} height={22} />
          <b aria-hidden="true">
            Brahm<em>astra</em>
          </b>
          <small aria-hidden="true">{brand.module}</small>
        </Link>

        <nav className="hdr-nav" aria-label="Main">
          <NavLink className="hdr-link" to="/courses">
            Courses
          </NavLink>
          {user ? (
            <>
              <NavLink className="hdr-link" to="/dashboard">
                Classroom
              </NavLink>
              <NavLink className="hdr-link" to="/studio">
                AI Studio
              </NavLink>
            </>
          ) : null}
        </nav>

        <div className="hdr-actions">
          <a
            className="hdr-parent"
            href={brand.parentUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            {brand.parent}
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M2 8l6-6M4 2h4v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>

          {user ? (
            <>
              <NotificationBell />
              <UserMenu user={user} />
            </>
          ) : (
            <>
              <Link className="ac-btn ac-btn--quiet ac-btn--sm" to="/sign-in">
                Sign in
              </Link>
              <Link className="ac-btn ac-btn--primary ac-btn--sm" to="/sign-up">
                Join the batch
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
