"use client";

import { useState } from "react";

type TrendingPromptCard = {
  id: string;
  title: string;
  prompt: string;
  imageUrl: string;
};

export function TrendingPrompts({ prompts }: { prompts: TrendingPromptCard[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyPrompt(prompt: TrendingPromptCard) {
    try {
      await navigator.clipboard.writeText(prompt.prompt);
      setCopiedId(prompt.id);
      window.setTimeout(() => setCopiedId((current) => (current === prompt.id ? null : current)), 1800);
    } catch (_error) {
      setCopiedId(null);
    }
  }

  if (prompts.length === 0) return null;

  return (
    <section className="trending-prompts-section" aria-label="Trending prompts">
      <div className="section-kicker">Trending Prompts</div>
      <div className="trending-prompts-heading">
        <h2>Copy The Prompt. Recreate The Shot.</h2>
        <p>Tap a card or use the copy button to grab the exact prompt behind the result.</p>
      </div>
      <div className="trending-prompts-scroll" role="list">
        {prompts.map((prompt) => (
          <article
            className="trending-prompt-card"
            key={prompt.id}
            role="listitem"
            tabIndex={0}
            onClick={() => copyPrompt(prompt)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                void copyPrompt(prompt);
              }
            }}
          >
            <img src={prompt.imageUrl} alt={prompt.title} loading="lazy" />
            <div className="trending-prompt-body">
              <h3>{prompt.title}</h3>
              <p>{prompt.prompt}</p>
              <button
                className="btn btn-secondary trending-copy-button"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  void copyPrompt(prompt);
                }}
              >
                {copiedId === prompt.id ? "Copied" : "Copy Prompt"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
