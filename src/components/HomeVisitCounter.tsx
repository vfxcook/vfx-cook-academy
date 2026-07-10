"use client";

import { useEffect, useState } from "react";

const HOME_VISIT_KEY = "vfxcook-home-visit-count";

export function HomeVisitCounter() {
  const [visitCount, setVisitCount] = useState<number | null>(null);

  useEffect(() => {
    try {
      const existing = window.localStorage.getItem(HOME_VISIT_KEY);
      const parsed = Number(existing ?? "0");
      const safeCount = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
      const next = safeCount + 1;
      window.localStorage.setItem(HOME_VISIT_KEY, String(next));
      setVisitCount(next);
    } catch (_error) {
      setVisitCount(null);
    }
  }, []);

  return (
    <article className="activity-item">
      <span>Your Visits</span>
      <strong>{visitCount ?? "--"}</strong>
      <small>Counted on this device/browser</small>
    </article>
  );
}
