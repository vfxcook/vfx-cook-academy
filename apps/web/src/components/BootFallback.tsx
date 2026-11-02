import type { CSSProperties } from 'react';

/** Set in Manrope, as in Frameon's own loader. */
const WORD = 'Frameon';

/** Mirrors the static boot shell in index.html so hydration never flashes. */
export default function BootFallback() {
  return (
    <div className="boot" role="status" aria-live="polite">
      <div className="boot-card">
        <div className="boot-emblem" aria-hidden="true">
          <span className="boot-aperture" />
          <span className="boot-trail" />
          <div className="boot-mark">
            <i className="boot-dots" />
            <i className="boot-fill" />
            <i className="boot-sheen" />
          </div>
        </div>
        <b className="boot-word" aria-label="Frameon Academy">
          {WORD.split('').map((letter, index) => (
            <span key={index} aria-hidden="true" style={{ '--i': index } as CSSProperties}>
              {letter}
            </span>
          ))}
        </b>
        <small className="boot-module" aria-hidden="true">
          Academy
        </small>
        <span className="boot-sub">Opening the Academy…</span>
        <div className="boot-bar" aria-hidden="true">
          <i />
        </div>
      </div>
    </div>
  );
}
