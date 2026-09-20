import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router';
import { STAGES, brand } from '../lib/content';
import '../styles/scene.css';

const FPS = 24;
const pad = (value: number) => String(value).padStart(2, '0');

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Film backdrop: drifting aurora, pointer spot, grid and grain. */
export function SceneBackdrop() {
  return (
    <div className="sc-bg" aria-hidden="true">
      <div className="sc-aurora" />
      <div className="sc-spot" />
      <div className="sc-grid" />
      <div className="sc-grain" />
    </div>
  );
}

/** Black bars and corner marks that frame any full-bleed scene. */
export function Letterbox() {
  return (
    <>
      <div className="ac-letterbox ac-letterbox--top" aria-hidden="true" />
      <div className="ac-letterbox ac-letterbox--bottom" aria-hidden="true" />
      <div className="ac-frame-marks" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
    </>
  );
}

/** A running timecode, counted from mount at 24fps. Purely atmospheric. */
export function Timecode() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const started = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const frames = Math.floor(((now - started) / 1000) * FPS);
      const seconds = Math.floor(frames / FPS);
      if (ref.current) {
        ref.current.textContent = `${pad(Math.floor(seconds / 3600))}:${pad(
          Math.floor(seconds / 60) % 60
        )}:${pad(seconds % 60)}:${pad(frames % FPS)}`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <span className="sc-rec" aria-hidden="true">
      <b />
      REC <span ref={ref}>00:00:00:00</span>
    </span>
  );
}

export function SceneHeader({ action }: { action?: ReactNode }) {
  return (
    <header className="sc-top">
      <Link className="sc-brand" to="/">
        <img src="/brand/logo-mark.png" alt="" width={22} height={22} />
        <span>
          VFX <em>Cook</em>
        </span>
      </Link>
      {action ?? <Timecode />}
    </header>
  );
}

/**
 * The six-stage rail. It advances on its own every few seconds and yields to the
 * pointer while someone is reading it, so hovering never fights the animation.
 */
export function PipelineRail() {
  const [stage, setStage] = useState(0);
  const hovered = useRef(false);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const timer = window.setInterval(() => {
      if (!hovered.current) setStage(value => (value + 1) % STAGES.length);
    }, 2800);
    return () => window.clearInterval(timer);
  }, []);

  const active = STAGES[stage];

  return (
    <div
      className="sc-pipeline"
      style={{ '--stages': STAGES.length } as CSSProperties}
      onPointerEnter={() => {
        hovered.current = true;
      }}
      onPointerLeave={() => {
        hovered.current = false;
      }}
    >
      <ol>
        {STAGES.map((item, index) => (
          <li
            key={item.id}
            data-active={index === stage || undefined}
            data-done={index < stage || undefined}
            onPointerEnter={() => setStage(index)}
          >
            <b>{item.number}</b>
            <span>{item.label}</span>
          </li>
        ))}
      </ol>
      <div className="sc-playhead" style={{ '--stage': stage } as CSSProperties} />
      <p key={active.id} className="sc-caption">
        <span className="ac-mono">{active.mentor}</span>
        {active.sub}
      </p>
    </div>
  );
}

interface CinemaSceneProps {
  eyebrow: string;
  headline: string[];
  ghost?: string;
  lede: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Split cinematic layout used by sign-in, sign-up and the magic-link screens:
 * the pitch on the left, a tilting glass card holding the form on the right.
 */
export default function CinemaScene({
  eyebrow,
  headline,
  ghost,
  lede,
  children,
  footer
}: CinemaSceneProps) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || prefersReducedMotion()) return;

    // Two eased followers: one for the backdrop spot, one for the card tilt.
    const pointer = { x: 0.5, y: 0.4, tx: 0.5, ty: 0.4, rx: 0, ry: 0, trx: 0, try: 0 };
    let raf = 0;

    const onMove = (event: PointerEvent) => {
      const box = scene.getBoundingClientRect();
      pointer.tx = (event.clientX - box.left) / box.width;
      pointer.ty = (event.clientY - box.top) / box.height;

      const card = cardRef.current?.getBoundingClientRect();
      if (card) {
        const cx = (event.clientX - card.left) / card.width - 0.5;
        const cy = (event.clientY - card.top) / card.height - 0.5;
        const near = Math.abs(cx) < 0.9 && Math.abs(cy) < 0.9;
        pointer.trx = near ? cy * -5 : 0;
        pointer.try = near ? cx * 6 : 0;
        cardRef.current?.style.setProperty('--cx', `${(cx + 0.5) * 100}%`);
        cardRef.current?.style.setProperty('--cy', `${(cy + 0.5) * 100}%`);
      }
    };

    const onLeave = () => {
      pointer.trx = 0;
      pointer.try = 0;
    };

    const tick = () => {
      pointer.x += (pointer.tx - pointer.x) * 0.08;
      pointer.y += (pointer.ty - pointer.y) * 0.08;
      pointer.rx += (pointer.trx - pointer.rx) * 0.1;
      pointer.ry += (pointer.try - pointer.ry) * 0.1;

      scene.style.setProperty('--mx', `${(pointer.x * 100).toFixed(2)}%`);
      scene.style.setProperty('--my', `${(pointer.y * 100).toFixed(2)}%`);
      scene.style.setProperty('--px', (pointer.x - 0.5).toFixed(4));
      scene.style.setProperty('--py', (pointer.y - 0.5).toFixed(4));
      cardRef.current?.style.setProperty('--rx', `${pointer.rx.toFixed(3)}deg`);
      cardRef.current?.style.setProperty('--ry', `${pointer.ry.toFixed(3)}deg`);

      raf = requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <div ref={sceneRef} className="sc">
      <SceneBackdrop />
      <Letterbox />
      <SceneHeader />

      <main className="sc-auth">
        <section className="sc-pitch">
          <p className="ac-eyebrow">{eyebrow}</p>
          <h1 className="ac-display">
            {headline.map((line, index) => (
              <span key={line} className="sc-mask" style={{ '--i': index } as CSSProperties}>
                <span>{line}</span>
              </span>
            ))}
            {ghost ? (
              <span
                className="sc-mask sc-ghost"
                style={{ '--i': headline.length } as CSSProperties}
              >
                <span>{ghost}</span>
              </span>
            ) : null}
          </h1>
          <p className="ac-lede">{lede}</p>
          <PipelineRail />
          <p className="ac-eyebrow">A module of {brand.parent}</p>
        </section>

        <section>
          <div ref={cardRef} className="sc-card">
            <div className="sc-card-body">{children}</div>
          </div>
          {footer}
        </section>
      </main>
    </div>
  );
}
