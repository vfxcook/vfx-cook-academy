import type { CSSProperties } from 'react';
import '../styles/stage-art.css';

/**
 * One line-art plate per pipeline stage. Everything is stroked SVG on a shared
 * palette so the set reads as a single illustration system, and each plate animates
 * only the one idea its stage is about.
 */

function PromptArt() {
  return (
    <svg viewBox="0 0 320 132" aria-hidden="true">
      <g className="sa-page">
        <rect className="sa-frame" x="18" y="16" width="66" height="90" rx="4" />
        <text className="sa-label" x="26" y="32">EXT. NIGHT</text>
        {[44, 54, 64, 74, 84].map((y, index) => (
          <rect
            key={y}
            className="sa-ink sa-script"
            x={index % 2 ? 34 : 26}
            y={y}
            width={index % 2 ? 38 : 48}
            height="3"
            rx="1.5"
            style={{ '--d': index } as CSSProperties}
          />
        ))}
      </g>
      <path className="sa-wire" d="M90 60h22" />
      <g className="sa-composition">
        <rect className="sa-frame sa-frame--hero" x="120" y="22" width="180" height="76" rx="4" />
        <path className="sa-thirds" d="M180 22v76M240 22v76M120 47h180M120 73h180" />
        <circle className="sa-subject" cx="180" cy="73" r="11" />
        <path className="sa-beam" d="M300 22 L200 73 L300 98 Z" />
      </g>
      <text className="sa-label sa-tc" x="120" y="116">50MM · f/1.8 · KEY 45°</text>
    </svg>
  );
}

function WorldArt() {
  return (
    <svg viewBox="0 0 320 132" aria-hidden="true">
      {[0, 1, 2].map(index => (
        <g key={index} className={`sa-card sa-card-${index}`} style={{ '--d': index } as CSSProperties}>
          <rect className="sa-frame" x={20 + index * 78} y="24" width="62" height="74" rx="4" />
          <circle className="sa-ink-fill" cx={51 + index * 78} cy="52" r="11" />
          <path className="sa-ink-stroke" d={`M${32 + index * 78} 84c0-11 8-18 19-18s19 7 19 18`} />
          <text className="sa-label" x={20 + index * 78} y="110">
            CAST {String(index + 1).padStart(2, '0')}
          </text>
        </g>
      ))}
      <g className="sa-lock">
        <rect className="sa-lock-body" x="262" y="56" width="22" height="16" rx="3" />
        <path className="sa-lock-shackle" d="M266 56v-4a7 7 0 0 1 14 0v4" />
      </g>
      <path className="sa-wire sa-link" d="M92 60h20M170 60h20M248 60h12" pathLength={1} />
    </svg>
  );
}

function MotionArt() {
  return (
    <svg viewBox="0 0 320 132" aria-hidden="true">
      <rect className="sa-frame" x="20" y="18" width="180" height="76" rx="4" />
      <circle className="sa-subject sa-dolly" cx="70" cy="58" r="13" />
      <path className="sa-path" d="M70 58C110 30 150 86 190 58" pathLength={1} />
      <g className="sa-camera">
        <rect className="sa-frame sa-frame--hero" x="236" y="42" width="46" height="28" rx="3" />
        <path className="sa-ink-fill" d="M282 50l16-8v28l-16-8z" />
        <circle className="sa-reel" cx="248" cy="36" r="7" />
        <circle className="sa-reel sa-reel--b" cx="268" cy="36" r="7" />
      </g>
      <rect className="sa-track" x="20" y="104" width="262" height="9" rx="2" />
      {[0, 1, 2, 3].map(index => (
        <rect
          key={index}
          className={`sa-clip sa-clip-${index}`}
          x={22 + index * 66}
          y="106"
          width="62"
          height="5"
          rx="1.5"
          style={{ '--d': index } as CSSProperties}
        />
      ))}
      <g className="sa-playhead">
        <rect className="sa-accent" x="20" y="98" width="2" height="21" rx="1" />
        <path className="sa-accent" d="M17 96h8l-4 5z" />
      </g>
    </svg>
  );
}

function SceneArt() {
  return (
    <svg viewBox="0 0 320 132" aria-hidden="true">
      {[
        { x: 18, y: 18, w: 88, h: 50, label: 'WIDE' },
        { x: 116, y: 18, w: 88, h: 50, label: 'MID' },
        { x: 214, y: 18, w: 88, h: 50, label: 'CLOSE' }
      ].map((shot, index) => (
        <g key={shot.label} className="sa-coverage" style={{ '--d': index } as CSSProperties}>
          <rect
            className={index === 1 ? 'sa-frame sa-frame--hero' : 'sa-frame'}
            x={shot.x}
            y={shot.y}
            width={shot.w}
            height={shot.h}
            rx="3"
          />
          <circle className="sa-ink-fill" cx={shot.x + shot.w / 2} cy={shot.y + 30} r={5 + index * 4} />
          <text className="sa-label" x={shot.x} y={shot.y + 62}>
            {shot.label}
          </text>
        </g>
      ))}
      <path className="sa-eyeline" d="M62 96h196" pathLength={1} />
      {[62, 160, 258].map(x => (
        <circle key={x} className="sa-accent-fill" cx={x} cy="96" r="3.5" />
      ))}
      <text className="sa-label sa-tc" x="18" y="120">180° LINE HELD</text>
    </svg>
  );
}

function FinishArt() {
  return (
    <svg viewBox="0 0 320 132" aria-hidden="true">
      <rect className="sa-frame" x="20" y="18" width="150" height="84" rx="4" />
      <g className="sa-grade">
        <rect className="sa-grade-a" x="21" y="19" width="74" height="82" />
        <rect className="sa-grade-b" x="95" y="19" width="74" height="82" />
        <rect className="sa-wipe" x="93" y="14" width="2" height="92" />
      </g>
      <g className="sa-wheels">
        {[0, 1, 2].map(index => (
          <circle
            key={index}
            className={`sa-wheel sa-wheel-${index}`}
            cx={208 + index * 42}
            cy="44"
            r="15"
            style={{ '--d': index } as CSSProperties}
          />
        ))}
      </g>
      <g className="sa-wave">
        {Array.from({ length: 22 }, (_, index) => (
          <rect
            key={index}
            className="sa-bar"
            x={196 + index * 5}
            y="78"
            width="3"
            height="14"
            rx="1.5"
            style={{ '--d': index } as CSSProperties}
          />
        ))}
      </g>
      <text className="sa-label sa-tc" x="196" y="110">MIX −14 LUFS</text>
    </svg>
  );
}

function DeliverArt() {
  return (
    <svg viewBox="0 0 320 132" aria-hidden="true">
      <g className="sa-master">
        <rect className="sa-frame sa-frame--hero" x="22" y="30" width="104" height="58" rx="4" />
        <path className="sa-ink-fill sa-play" d="M62 48l26 15-26 15z" />
        <text className="sa-label" x="22" y="102">MASTER</text>
      </g>
      {[
        { y: 20, label: '16:9' },
        { y: 54, label: '9:16' },
        { y: 88, label: '1:1' }
      ].map((out, index) => (
        <g key={out.label} className="sa-out" style={{ '--d': index } as CSSProperties}>
          <path className="sa-wire sa-link" d={`M132 59C164 59 172 ${out.y + 12} 206 ${out.y + 12}`} pathLength={1} />
          <rect className="sa-frame" x="210" y={out.y} width="56" height="24" rx="3" />
          <text className="sa-label" x="274" y={out.y + 16}>
            {out.label}
          </text>
          <path className="sa-tick" d={`M214 ${out.y + 12} l4 5 8 -10`} pathLength={1} />
        </g>
      ))}
    </svg>
  );
}

const PLATES: Record<string, () => React.JSX.Element> = {
  prompt: PromptArt,
  world: WorldArt,
  motion: MotionArt,
  scene: SceneArt,
  finish: FinishArt,
  deliver: DeliverArt
};

export default function StageArt({ id }: { id: string }) {
  const Plate = PLATES[id];
  if (!Plate) return null;
  return (
    <div className="sa-plate">
      <Plate />
    </div>
  );
}
