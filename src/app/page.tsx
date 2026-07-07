import Link from "next/link";

import {
  galleryImages,
  getEnrollHref,
  heroCopy,
  insightCards,
  landingBackgrounds,
  learningItems,
  valueProps,
} from "@/lib/landing";
import { getPublishedCoursesCached } from "@/lib/public-data";
import { formatInr } from "@/lib/utils";

export default async function HomePage() {
  let courses: Array<{
    id: string;
    slug: string;
    title: string;
    description: string;
    priceInr: number;
    thumbnailUrl: string | null;
    availableFrom: Date | null;
    isPublished: boolean;
    createdAt: Date;
    updatedAt: Date;
    videos: Array<{ id: string }>;
  }> = [];
  try {
    courses = await getPublishedCoursesCached();
  } catch (error) {
    console.error("Failed to load published courses on homepage", error);
  }
  const mainCourse = courses[0];
  const enrollHref = getEnrollHref(mainCourse);
  const showreelUrl = "https://www.youtube.com/embed/-fI2FQ8FqPk";

  return (
    <div className="landing-page">
      <div className="landing-background" aria-hidden="true">
        {landingBackgrounds.map((background, index) => (
          <div
            className="landing-bg-layer"
            key={background.src}
            style={{
              animationDelay: `${index * 6 - 1}s`,
              backgroundImage: `url("${background.src}")`,
            }}
          />
        ))}
        <div className="landing-bg-vignette" />
      </div>

      <div className="landing-frame" aria-hidden="true">
        <span className="corner corner-top-left" />
        <span className="corner corner-top-right" />
        <span className="corner corner-bottom-left" />
        <span className="corner corner-bottom-right" />
      </div>

      <section className="landing-hero" id="courses">
        <div className="hero-copy">
          <span className="batch-pill">
            <span className="batch-dot" />
            {heroCopy.badge}
          </span>
          <h1 className="hero-title">
            <span>{heroCopy.titlePrefix}</span>
            <strong>{heroCopy.titlePrimary}</strong>
            <span>{heroCopy.titleSuffix}</span>
          </h1>
          <p className="hero-description">{heroCopy.description}</p>
          <div className="hero-actions">
            <Link className="btn btn-primary btn-lg" href={enrollHref}>
              {heroCopy.primaryCta}
              <span aria-hidden="true">&gt;</span>
            </Link>
            <Link className="btn btn-secondary btn-lg" href="#pricing">
              {heroCopy.secondaryCta}
            </Link>
          </div>
          <div className="proof-row">
            <div className="proof-stack" aria-hidden="true">
              <span>VC</span>
              <span>AI</span>
              <span>FX</span>
              <span>ML</span>
            </div>
            <p>{heroCopy.proof}</p>
          </div>
        </div>

        <article className="showreel-card" aria-label="VFX Cook cinematic showreel">
          <div className="showreel-meta">
            <span>{heroCopy.eyebrow}</span>
            <div>
              <h2>The 9th Lock. A mystery AI film trailer</h2>
              <p>by VFX Cook</p>
            </div>
          </div>
          <div className="showreel-video">
            <iframe
              src={showreelUrl}
              title="VFX Cook Academy Cinematic Showreel"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </article>
      </section>

      <section className="value-strip" aria-label="Course strengths">
        {valueProps.map((item) => (
          <article className="value-item" key={item.title}>
            <span className="icon-badge" aria-hidden="true">
              {item.icon}
            </span>
            <div>
              <h2>{item.title}</h2>
              <p>{item.text}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="insight-grid" id="about">
        {insightCards.map((card) => (
          <article className="info-card" key={card.title}>
            <h2>{card.title}</h2>
            {card.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </article>
        ))}
      </section>

      <section className="gallery-section" aria-label="Carousel Gallery">
        <div className="section-kicker">Carousel Gallery</div>
        <div className="gallery-carousel">
          <div className="gallery-track">
            {[...galleryImages, ...galleryImages].map((image, index) => (
              <figure className="gallery-slide" key={`${image.src}-${index}`}>
                <img src={image.src} alt={image.label} loading="lazy" />
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="learn-section">
        <div className="section-kicker">What you will learn</div>
        <h2>From Prompt to Powerful Cinema</h2>
        <p>Master the complete AI filmmaking workflow with a cinematic mindset.</p>
        <div className="learning-grid">
          {learningItems.map((item) => (
            <article className="learning-tile" key={item.text}>
              <span className="tile-icon" aria-hidden="true">
                {item.icon}
              </span>
              <h3>{item.text}</h3>
            </article>
          ))}
        </div>
      </section>

      <section className="join-banner" id="pricing">
        <div className="join-art" aria-hidden="true">
          <span />
        </div>
        <div>
          <h2>Ready to Create Cinema with AI?</h2>
          <p>Join now and start your journey to becoming a cinematic AI creator.</p>
        </div>
        <div className="join-price">
          <span>{mainCourse ? formatInr(mainCourse.priceInr) : "Pricing updates soon"}</span>
          <Link className="btn btn-primary btn-lg" href={enrollHref}>
            {heroCopy.primaryCta}
            <span aria-hidden="true">&gt;</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
