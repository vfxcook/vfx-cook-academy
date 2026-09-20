/** Mirrors the static boot shell in index.html so hydration never flashes. */
export default function BootFallback() {
  return (
    <div className="boot" role="status" aria-live="polite">
      <div className="boot-card">
        <div className="boot-emblem" aria-hidden="true">
          <span className="boot-aperture" />
          <div className="boot-mark">
            <i className="boot-sheen" />
          </div>
        </div>
        <b className="boot-word" aria-label="VFX Cook Academy">
          {['V', 'F', 'X', ' ', 'C', 'O', 'O', 'K'].map((letter, index) => (
            <span
              key={`${letter}-${index}`}
              aria-hidden="true"
              className={index > 3 ? 'is-hot' : undefined}
              style={{ ['--i' as string]: index }}
            >
              {letter}
            </span>
          ))}
        </b>
        <span className="boot-sub">Rolling the Academy…</span>
        <div className="boot-bar" aria-hidden="true">
          <i />
        </div>
        <small className="boot-meta" aria-hidden="true">
          A module of brahmastra.studio
        </small>
      </div>
    </div>
  );
}
