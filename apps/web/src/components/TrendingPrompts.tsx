import { useState } from 'react';
import type { TrendingPrompt } from '../lib/types';

/** The prompt library strip: the exact prompt behind each frame, one tap to copy. */
export default function TrendingPrompts({ prompts }: { prompts: TrendingPrompt[] }) {
  const [copied, setCopied] = useState<string | null>(null);

  if (prompts.length === 0) return null;

  const copy = async (prompt: TrendingPrompt) => {
    try {
      await navigator.clipboard.writeText(prompt.prompt);
      setCopied(prompt.id);
      window.setTimeout(() => setCopied(current => (current === prompt.id ? null : current)), 1800);
    } catch {
      setCopied(null);
    }
  };

  return (
    <section className="ac-shell ac-section" aria-labelledby="prompts-heading">
      <div className="page-head">
        <p className="ac-eyebrow">From the prompt library</p>
        <h2 id="prompts-heading" className="ac-display" style={{ fontSize: 'clamp(28px, 3.8vw, 46px)' }}>
          Copy the prompt. Recreate the shot.
        </h2>
        <p className="ac-lede">The exact prompts behind frames from the batch — take one apart, then make it yours.</p>
      </div>

      <div className="tp-strip">
        {prompts.map(prompt => (
          <article key={prompt.id} className="ac-panel tp-card">
            <div className="tp-frame">
              <img src={prompt.imageUrl} alt={prompt.title} loading="lazy" />
            </div>
            <div className="tp-body">
              <h3>{prompt.title}</h3>
              <p>{prompt.prompt}</p>
              <button
                type="button"
                className={`ac-btn ac-btn--sm ${copied === prompt.id ? 'ac-btn--ember' : 'ac-btn--ghost'}`}
                onClick={() => copy(prompt)}
              >
                {copied === prompt.id ? 'Copied' : 'Copy prompt'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
