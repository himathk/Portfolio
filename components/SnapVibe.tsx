'use client';

import { useEffect, useState } from 'react';

const SITE = 'https://snap-vibe-phi.vercel.app';
const MEDIA = '/work/snapvibe';

/* Two pages of the real product. The Composing Room is SnapVibe's cover editor;
   it only runs on desktop (on a phone it shows its own "desktop affair" notice),
   so phones get a still of it instead of loading that notice. */
const TABS = [
  { key: 'site', label: 'The site', path: '', poster: `${MEDIA}/site.webp`, posterPhone: `${MEDIA}/site-m.webp`, phone: true },
  { key: 'studio', label: 'The Composing Room', path: '/studio', poster: `${MEDIA}/studio.webp`, posterPhone: `${MEDIA}/studio.webp`, phone: false },
];

export default function SnapVibe() {
  const [tab, setTab] = useState(0);
  const [live, setLive] = useState(false);
  const [phone, setPhone] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const sync = () => setPhone(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const t = TABS[tab];
  const canRun = !phone || t.phone;

  // The custom cursor grows over this button and shrinks on its mouseleave, which
  // never fires once the button unmounts; hand it that leave before swapping in the page.
  const start = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.dispatchEvent(new MouseEvent('mouseleave'));
    setLive(true);
  };

  return (
    <section className="live" id="snapvibe" aria-labelledby="snapvibe-title">
      <div className="live__head">
        <span className="mono live__kicker">02 / Live project</span>
        <h3 className="live__title" id="snapvibe-title">
          SnapVibe
        </h3>
        <div className="live__copy">
        <p className="live__sub">
          Magazine-cover photo booths for weddings, hotels and corporate events in Sri Lanka. I designed and
          built it on my own, down to the Composing Room, a working cover editor. Don&apos;t take my word for it:
          step in and use it.
        </p>
        <dl className="live__meta mono">
          <div>
            <dt>Role</dt>
            <dd>Solo design &amp; build</dd>
          </div>
          <div>
            <dt>Year</dt>
            <dd>2026</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>Live</dd>
          </div>
        </dl>
        </div>
      </div>

      <div className="live__window">
        <div className="live__bar mono">
          <span className="live__dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <div className="live__tabs" role="tablist" aria-label="SnapVibe pages">
            {TABS.map((x, i) => (
              <button
                key={x.key}
                type="button"
                role="tab"
                aria-selected={i === tab}
                className={`live__tab${i === tab ? ' is-on' : ''}`}
                data-cursor="hover"
                onClick={() => setTab(i)}
              >
                {x.label}
              </button>
            ))}
          </div>
          <span className={`live__url${live && canRun ? ' is-live' : ''}`}>snap-vibe-phi.vercel.app{t.path}</span>
          {live && canRun && (
            <button type="button" className="live__close" data-cursor="hover" onClick={() => setLive(false)}>
              Close live ✕
            </button>
          )}
          <a className="live__open" href={SITE + t.path} target="_blank" rel="noopener noreferrer" data-cursor="hover">
            Open ↗
          </a>
        </div>

        <div className="live__view">
          {live && canRun ? (
            // keyed by tab so switching pages loads the other page fresh
            <iframe key={t.key} src={SITE + t.path} title={`SnapVibe: ${t.label}`} allow="fullscreen; clipboard-write" />
          ) : (
            <>
              <picture>
                <source media="(max-width: 900px)" srcSet={t.posterPhone} />
                <img
                  className="live__poster"
                  src={t.poster}
                  alt={`SnapVibe, ${t.label.toLowerCase()}`}
                  width={1440}
                  height={900}
                  loading="lazy"
                />
              </picture>
              {canRun ? (
                <button type="button" className="live__start" data-cursor="hover" onClick={start}>
                  <span className="live__start-title">Step into the cover</span>
                  <span className="mono">Load the live {t.key === 'studio' ? 'editor' : 'site'} right here</span>
                </button>
              ) : (
                <p className="live__desk mono">The Composing Room runs on desktop. Open this page on a computer to use it.</p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
