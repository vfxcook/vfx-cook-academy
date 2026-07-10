"use client";

import { useEffect, useState } from "react";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  actorUser: {
    name: string | null;
    email: string | null;
  } | null;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  async function loadNotifications() {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    const data = (await response.json()) as { items?: NotificationItem[]; unreadCount?: number };
    if (!response.ok) return;
    setItems(data.items ?? []);
    setUnreadCount(data.unreadCount ?? 0);
  }

  async function markAllRead() {
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    if (!response.ok) return;
    setUnreadCount(0);
    setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
  }

  useEffect(() => {
    void loadNotifications();
    const timer = window.setInterval(() => {
      void loadNotifications();
    }, 20000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="notification-bell-shell">
      <button className="notification-bell-btn" type="button" onClick={() => setOpen((prev) => !prev)}>
        <span className="notification-bell-icon" aria-hidden="true">
          🔔
        </span>
        {unreadCount > 0 ? <span className="notification-bell-badge">{unreadCount}</span> : null}
      </button>
      {open ? (
        <div className="card notification-panel">
          <div className="notification-panel-head">
            <strong>Notifications</strong>
            <button className="btn btn-secondary" type="button" onClick={markAllRead}>
              Mark all read
            </button>
          </div>
          {items.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              No notifications yet.
            </p>
          ) : (
            items.map((item) => (
              <article
                key={item.id}
                className={`notification-item ${item.isRead ? "notification-item-read" : "notification-item-unread"}`}
              >
                <strong>{item.title}</strong>
                <p className="muted">
                  {item.actorUser?.name ?? item.actorUser?.email ?? "System"} - {item.message}
                </p>
              </article>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
