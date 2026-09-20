import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useLoaderData } from 'react-router';
import CourseCard from '../components/CourseCard';
import { Letterbox, PipelineRail, SceneBackdrop } from '../components/CinemaScene';
import StageArt from '../components/StageArt';
import { api } from '../lib/api';
import { STAGES, faqs, gallery, hero, learningOutcomes, valueProps } from '../lib/content';
import type { CourseSummary } from '../lib/types';
import '../styles/home.css';

export async function homeLoader() {
  const [courses, prompts] = await Promise.all([
    api.courses.list().catch(() => ({ courses: [] as CourseSummary[] })),
    api.courses.trendingPrompts().catch(() => ({ prompts: [] }))
  ]);
  return { courses: courses.courses, prompts: prompts.prompts };
}

/** Cross-fading plate carousel that doubles as the hero's "monitor". */
function HeroSlate() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setIndex(value => (value + 1) % gallery.length), 4200);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="ac-panel home-slate">
      <div className="home-slate-frame">
        {gallery.map((plate, plateIndex) => (
          <img
            key={plate.src}
            src={plate.src}
            alt={plateIndex === index ? plate.alt : ''}
            data-live={plateIndex === index || undefined}
            loading={plateIndex === 0 ? 'eager' : 'lazy'}
            aria-hidden={plateIndex === index ? undefined : true}
          />
        ))}
        <div className="home-slate-meta">
          <span>VFX Cook · Plate {String(index + 1).padStart(2, '0')}</span>
          <span>Shot on Brahmastra</span>
        </div>
      </div>
      <div className="home-slate-strip" role="tablist" aria-label="Reference plates">
        {gallery.map((plate, plateIndex) => (
          <button
            key={plate.src}
            type="button"
            role="tab"
            aria-selected={plateIndex === index}
            aria-label={`Plate ${plateIndex + 1}`}
            data-live={plateIndex === index || undefined}
            onClick={() => setIndex(plateIndex)}
          />
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const { courses } = useLoaderData<typeof homeLoader>();
  const featured = courses.slice(0, 3);

  return (
    <div className="sc" style={{ minHeight: 'auto' }}>
      <SceneBackdrop />
      <Letterbox />

      <section className="home-hero">
        <div className="ac-shell home-hero-inner">
          <div className="home-hero-copy">
            <p className="ac-eyebrow">{hero.eyebrow}</p>
            <h1>
              {hero.headline.map((line, index) => (
                <span key={line} className="sc-mask" style={{ '--i': index } as CSSProperties}>
                  <span>{line}</span>
                </span>
              ))}
              <span
                className="sc-mask sc-ghost"
                style={{ '--i': hero.headline.length } as CSSProperties}
              >
                <span>{hero.ghost}</span>
              </span>
            </h1>
            <p className="ac-lede">{hero.lede}</p>
            <p className="home-proof">
              <span className="ac-dot" />
              {hero.proof}
            </p>
            <div className="home-cta">
              <Link className="ac-btn ac-btn--primary ac-btn--lg" to="/courses">
                {hero.primaryCta}
              </Link>
              {featured[0] ? (
                <Link className="ac-btn ac-btn--ghost ac-btn--lg" to={`/courses/${featured[0].slug}`}>
                  {hero.secondaryCta}
                </Link>
              ) : null}
            </div>
          </div>

          <HeroSlate />
        </div>

        <div className="ac-shell">
          <PipelineRail />
        </div>
      </section>

      <section className="ac-shell ac-section" aria-labelledby="why">
        <div className="page-head">
          <p className="ac-eyebrow">Why this, why now</p>
          <h2 id="why" className="ac-display" style={{ fontSize: 'clamp(28px, 3.8vw, 46px)' }}>
            AI tools are easy.
            <br />
            Cinematic output is not.
          </h2>
          <p className="ac-lede">
            A model can generate. Only a director can judge. We teach the judgement — and the
            workflow that turns it into finished work.
          </p>
        </div>

        <div className="home-props">
          {valueProps.map(prop => (
            <article key={prop.id} className="ac-panel home-prop">
              <span className="home-prop-rule" />
              <h3>{prop.title}</h3>
              <p>{prop.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="ac-shell ac-section" aria-labelledby="pipeline">
        <div className="page-head">
          <p className="ac-eyebrow">The six stages</p>
          <h2 id="pipeline" className="ac-display" style={{ fontSize: 'clamp(28px, 3.8vw, 46px)' }}>
            The same pipeline the studio runs on.
          </h2>
          <p className="ac-lede">
            Each stage you learn here maps onto a stage inside brahmastra.studio. Finish the course
            and the tool already makes sense.
          </p>
        </div>

        <div className="home-stages">
          {STAGES.map(item => (
            <article key={item.id} className="home-stage">
              <span className="home-stage-no" aria-hidden="true">
                {item.number}
              </span>
              <div className="home-stage-body">
                <span className="ac-chip ac-chip--ember">{item.label}</span>
                <h3>{item.title}</h3>
                <p>{item.sub}</p>
              </div>
              <StageArt id={item.id} />
            </article>
          ))}
        </div>
      </section>

      {featured.length > 0 ? (
        <section className="ac-shell ac-section" aria-labelledby="courses">
          <div className="page-head">
            <div className="ac-between" style={{ flexWrap: 'wrap' }}>
              <div>
                <p className="ac-eyebrow">Now enrolling</p>
                <h2 id="courses" className="ac-display" style={{ fontSize: 'clamp(28px, 3.8vw, 46px)' }}>
                  Pick your batch.
                </h2>
              </div>
              <Link className="ac-btn ac-btn--ghost" to="/courses">
                All courses
              </Link>
            </div>
          </div>

          <div className="ac-grid">
            {featured.map(course => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="home-reel" aria-label="Work from the batch">
        <div className="home-reel-track">
          {[...gallery, ...gallery].map((plate, index) => (
            <figure key={`${plate.src}-${index}`}>
              <img src={plate.src} alt={index < gallery.length ? plate.alt : ''} loading="lazy" />
            </figure>
          ))}
        </div>
      </section>

      <section className="ac-shell ac-section" aria-labelledby="outcomes">
        <div className="page-head">
          <p className="ac-eyebrow">What you walk out with</p>
          <h2 id="outcomes" className="ac-display" style={{ fontSize: 'clamp(28px, 3.8vw, 46px)' }}>
            Nine things you will be able to do.
          </h2>
        </div>

        <div className="home-outcomes">
          {learningOutcomes.map((outcome, index) => (
            <div key={outcome} className="home-outcome">
              <b>{String(index + 1).padStart(2, '0')}</b>
              <span>{outcome}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="ac-shell ac-section" aria-labelledby="faq">
        <div className="page-head">
          <p className="ac-eyebrow">Before you enrol</p>
          <h2 id="faq" className="ac-display" style={{ fontSize: 'clamp(28px, 3.8vw, 46px)' }}>
            Questions we get asked.
          </h2>
        </div>

        <div className="home-faq">
          {faqs.map(item => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="ac-shell" style={{ paddingBottom: 'clamp(48px, 7vw, 96px)' }}>
        <div className="ac-panel home-close">
          <p className="ac-eyebrow">Roll camera</p>
          <h2 className="ac-display" style={{ fontSize: 'clamp(28px, 4.2vw, 52px)' }}>
            Stop generating. Start directing.
          </h2>
          <p className="ac-lede" style={{ textAlign: 'center' }}>
            Join the Malayalam batch and learn the craft that separates a prompt from a film.
          </p>
          <div className="home-cta" style={{ justifyContent: 'center' }}>
            <Link className="ac-btn ac-btn--primary ac-btn--lg" to="/courses">
              See the courses
            </Link>
            <Link className="ac-btn ac-btn--ghost ac-btn--lg" to="/sign-up">
              Create an account
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
