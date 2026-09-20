import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { initials } from '../lib/format';

export function Avatar({
  name,
  src,
  size = 'md'
}: {
  name: string | null;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const className = `ac-avatar${size === 'lg' ? ' ac-avatar--lg' : size === 'sm' ? ' ac-avatar--sm' : ''}`;
  if (src) return <img className={className} src={src} alt="" loading="lazy" />;
  return (
    <span className={className} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function Meter({ percent, label }: { percent: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div
      className="ac-meter"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? 'Progress'}
    >
      <i style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="ac-field">
      <label className="ac-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && !error ? <span className="ac-hint">{hint}</span> : null}
      {error ? <span className="ac-error">{error}</span> : null}
    </div>
  );
}

export function Notice({
  tone = 'info',
  children
}: {
  tone?: 'info' | 'warn' | 'error' | 'ok';
  children: ReactNode;
}) {
  const suffix = tone === 'info' ? '' : ` ac-notice--${tone}`;
  return (
    <p className={`ac-notice${suffix}`} role={tone === 'error' ? 'alert' : undefined}>
      {children}
    </p>
  );
}

export function EmptyState({
  title,
  children,
  action
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="ac-empty">
      <svg width="52" height="40" viewBox="0 0 52 40" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="50" height="38" rx="4" stroke="currentColor" strokeOpacity=".3" />
        <path d="M1 9h50M1 31h50" stroke="currentColor" strokeOpacity=".18" />
        <circle cx="26" cy="20" r="6" stroke="currentColor" strokeOpacity=".4" />
        <path d="M23 20h6M26 17v6" stroke="currentColor" strokeOpacity=".4" strokeLinecap="round" />
      </svg>
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

/**
 * Modal with a focus trap, Escape-to-close and a restore of the previously
 * focused element, so keyboard users are never stranded behind the backdrop.
 */
export function Dialog({
  title,
  onClose,
  children,
  footer,
  wide
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusTo.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusable = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );

    focusable()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusTo.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="ac-dialog-backdrop"
      onPointerDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="ac-panel ac-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={wide ? { width: 'min(820px, 100%)' } : undefined}
      >
        <div className="ac-between" style={{ marginBottom: 18 }}>
          <h2 className="ac-title" style={{ fontSize: 21 }}>
            {title}
          </h2>
          <button type="button" className="ac-btn ac-btn--quiet ac-btn--sm" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
        {footer ? (
          <div className="ac-row" style={{ justifyContent: 'flex-end', marginTop: 22 }}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Aperture spinner used for route transitions and in-place loading. */
export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span className="ac-spinner" role="status" aria-label={label}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeOpacity=".16" />
        <path
          d="M18.5 10A8.5 8.5 0 0 0 10 1.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
