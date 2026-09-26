'use client';

import { useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import LoopVideo from '@/components/LoopVideo';
import WatchButton from '@/components/WatchButton';

gsap.registerPlugin(ScrollTrigger, useGSAP);

const MEDIA = '/work/aegis';
const TRAILER_ID = 'opLe1FIWPz8';
const PROMO_ID = 'Ymumnz8YVtU';

/* Entity tags, in the categories Aegis itself extracts. Tagged text lights up as
   it scrolls in: the page runs a staged version of the thing he built. */
type Kind = 'person' | 'location' | 'org' | 'date' | 'number';
const KIND_LABEL: Record<Kind, string> = {
  person: 'Person',
  location: 'Location',
  org: 'Organization',
  date: 'DateTime',
  number: 'Number',
};

function Ent({ k, children }: { k: Kind; children: ReactNode }) {
  return (
    <span className={`ent ent--${k}`} data-label={KIND_LABEL[k]}>
      {children}
    </span>
  );
}

const SCREENS: { key: string; path: string; w: number; h: number; caption: ReactNode }[] = [
  {
    key: 'login',
    path: 'aegisseeker / login',
    w: 1920,
    h: 912,
    caption: (
      <>
        The front door. Built for <Ent k="location">Sri Lankan</Ent> law enforcement, where every
        session is authenticated and logged.
      </>
    ),
  },
  {
    key: 'dashboard',
    path: 'aegisseeker / dashboard',
    w: 1920,
    h: 2502,
    caption: <>The command centre: cases, evidence and every relationship the system has found, in one view.</>,
  },
  {
    key: 'evidence',
    path: 'aegisseeker / evidence-management',
    w: 1920,
    h: 912,
    caption: (
      <>
        Entity extraction, the part I built. Every uploaded document comes back with its entities
        tagged and ready to link.
      </>
    ),
  },
  {
    key: 'case',
    path: 'aegisseeker / case-management',
    w: 1920,
    h: 1014,
    caption: <>Every entity becomes a node. The multi-modal knowledge graph shows how a case connects.</>,
  },
  {
    key: 'staff',
    path: 'aegisseeker / staff-management',
    w: 1920,
    h: 997,
    caption: <>Staff and role management, with each officer&apos;s caseload at a glance.</>,
  },
];

const ROLES: { label: string; line: ReactNode }[] = [
  { label: 'Team lead', line: <>Led a team of <Ent k="number">six</Ent> from first sketch to deployment.</> },
  {
    label: 'Machine learning',
    line: <>Built the entity extraction that turns raw documents into people, places, organisations and dates.</>,
  },
  { label: 'UI/UX', line: <>Designed every screen of the web app.</> },
  { label: 'Motion', line: <>Designed and animated the promo in <Ent k="org">After Effects</Ent>.</> },
  { label: 'Film', line: <>Directed, shot and edited the trailer, and played the lead.</> },
];

/** First screen of the case study: what the Aegis row grows into. */
export function AegisOpening() {
  return (
    <div className="case-open">
      <LoopVideo className="case-open__video" src={`${MEDIA}/trailer-loop.mp4`} poster={`${MEDIA}/trailer-poster.webp`} />
      <div className="case-open__inner">
        <span className="mono case-open__kicker">01 / Case study</span>
        <h3 className="case-open__title">Aegis</h3>
        <p className="case-open__sub">Automated evidence and graph intelligence for Sri Lankan law enforcement.</p>
        <dl className="case-open__meta mono">
          <div>
            <dt>Role</dt>
            <dd>Team lead · ML · UI/UX · Film</dd>
          </div>
          <div>
            <dt>Team</dt>
            <dd>6 people</dd>
          </div>
          <div>
            <dt>Year</dt>
            <dd>2025-26</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>Deployed</dd>
          </div>
        </dl>
        <WatchButton id={TRAILER_ID} label="Watch the trailer" title="Aegis trailer" />
      </div>
    </div>
  );
}

/** Last screen of the case study: what folds back into the list. */
export function AegisEnd() {
  return (
    <div className="case-end">
      <img className="case-end__img" src={`${MEDIA}/promo-endcard.webp`} alt="" />
      <p className="case-end__line">Every lead. Every time.</p>
    </div>
  );
}

export default function AegisCase() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const tagged = [...el.querySelectorAll<HTMLElement>('[data-ents]')];
      const chapters = [...el.querySelectorAll<HTMLElement>('.case__ch')];

      // stagger each paragraph's tags so they arrive one after another, like results
      tagged.forEach((p) =>
        p.querySelectorAll<HTMLElement>('.ent').forEach((e, i) => e.style.setProperty('--d', `${i * 140}ms`)),
      );

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        tagged.forEach((p) => p.classList.add('is-tagged'));
        chapters.forEach((c) => c.classList.add('is-lit'));
        return;
      }

      // the line that connects the chapters, drawn by the scroll
      gsap.fromTo(
        '.case__line i',
        { scaleY: 0 },
        { scaleY: 1, ease: 'none', scrollTrigger: { trigger: el, start: 'top 55%', end: 'bottom 55%', scrub: 0.4 } },
      );
      // each chapter's node lights when the line reaches it, and stays lit
      chapters.forEach((c) =>
        ScrollTrigger.create({
          trigger: c,
          start: 'top 55%',
          onEnter: () => c.classList.add('is-lit'),
          onLeaveBack: () => c.classList.remove('is-lit'),
        }),
      );
      tagged.forEach((p) =>
        ScrollTrigger.create({ trigger: p, start: 'top 82%', once: true, onEnter: () => p.classList.add('is-tagged') }),
      );

      // Screens stack on desktop: each card sticks, and the one before it sinks back
      // as the next slides over. The dashboard is a tall capture, so it scrolls
      // inside its own frame while stuck.
      const mm = gsap.matchMedia();
      mm.add('(min-width: 901px)', () => {
        const slots = [...el.querySelectorAll<HTMLElement>('.screen')];
        slots.forEach((slot, i) => {
          const next = slots[i + 1];
          if (!next) return;
          // explicit start: tweening from the computed 'none', GSAP reads brightness 0
          // and the card being looked at goes black instead of dimming later
          gsap.fromTo(
            slot.querySelector('.screen__card'),
            { scale: 1, filter: 'brightness(1)' },
            {
              scale: 0.9,
              filter: 'brightness(0.35)',
              ease: 'none',
              scrollTrigger: { trigger: next, start: 'top bottom', end: 'top 20%', scrub: true },
            },
          );
        });
        const tall = el.querySelector<HTMLElement>('.screen--tall');
        const img = tall?.querySelector<HTMLImageElement>('.screen__img');
        const view = tall?.querySelector<HTMLElement>('.screen__view');
        if (tall && img && view) {
          gsap.to(img, {
            y: () => -(img.offsetHeight - view.clientHeight),
            ease: 'none',
            scrollTrigger: {
              trigger: tall,
              start: 'top top',
              end: 'bottom bottom',
              scrub: true,
              invalidateOnRefresh: true,
            },
          });
        }
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <article className="case" id="aegis" ref={root} aria-label="Aegis case study">
      <div className="case__line" aria-hidden="true">
        <i />
      </div>

      <section className="case__ch">
        <header className="case__head">
          <span className="case__node" aria-hidden="true" />
          <span className="mono case__label">01 / The problem</span>
        </header>
        <h4 className="case__title">The answer is already in the files. Nobody has time to find it.</h4>
        <p className="case__body">
          Evidence arrives in every format: call records, immigration logs, flight manifests, statements,
          scans. The link that cracks a case is usually split across documents nobody has time to read side
          by side.
        </p>
        <figure className="case__still">
          <img src={`${MEDIA}/trailer-board.webp`} alt="An investigator at his desk at night, head in his hand, under a whiteboard of unanswered connections" width={1600} height={773} loading="lazy" />
          <figcaption className="case__cap" data-ents>
            From the Aegis trailer, directed, shot and edited by <Ent k="person">Himath Kariyawasam</Ent>, who also plays the lead.
          </figcaption>
        </figure>
      </section>

      <section className="case__ch">
        <header className="case__head">
          <span className="case__node" aria-hidden="true" />
          <span className="mono case__label">02 / The product</span>
        </header>
        <h4 className="case__title">Aegis reads the evidence, so the investigator can read the case.</h4>
        <p className="case__body" data-ents>
          Upload anything, in any format. Aegis pulls out every <Ent k="person">person</Ent>,{' '}
          <Ent k="location">place</Ent>, <Ent k="org">organisation</Ent> and <Ent k="date">date</Ent>, then
          links them into one knowledge graph, so the connection surfaces instead of hiding.
        </p>
        <figure className="case__film">
          <LoopVideo className="case__video" src={`${MEDIA}/promo.mp4`} poster={`${MEDIA}/promo-poster.webp`} />
          <figcaption className="case__cap case__cap--row">
            <span>The promo. I designed and animated it.</span>
            <WatchButton id={PROMO_ID} label="Watch with sound" title="Aegis promo" />
          </figcaption>
        </figure>
      </section>

      <section className="case__ch">
        <header className="case__head">
          <span className="case__node" aria-hidden="true" />
          <span className="mono case__label">03 / The system</span>
        </header>
        <h4 className="case__title">Five screens from the deployed system. I designed every one.</h4>
        <div className="screens">
          {SCREENS.map((s, i) => (
            <div className={`screen${s.h > s.w ? ' screen--tall' : ''}`} key={s.key}>
              <div className="screen__card">
                <div className="screen__bar mono" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <span>{s.path}</span>
                </div>
                <div className="screen__view">
                  <img
                    className="screen__img"
                    src={`${MEDIA}/screen-${s.key}.webp`}
                    alt={`Aegis ${s.key} screen`}
                    width={s.w}
                    height={s.h}
                    loading="lazy"
                  />
                </div>
                <p className="screen__cap" data-ents>
                  <span className="mono">03.{i + 1}</span>
                  <span>{s.caption}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="case__ch">
        <header className="case__head">
          <span className="case__node" aria-hidden="true" />
          <span className="mono case__label">04 / What I did</span>
        </header>
        <h4 className="case__title">I led it end to end.</h4>
        <ul className="roles">
          {ROLES.map((r) => (
            <li className="roles__i" key={r.label}>
              <span className="mono roles__label">{r.label}</span>
              <p data-ents>{r.line}</p>
            </li>
          ))}
        </ul>
        <a className="case__cta mono" href="https://info.aegisseeker.com" target="_blank" rel="noopener noreferrer" data-cursor="hover">
          Visit info.aegisseeker.com ↗
        </a>
      </section>
    </article>
  );
}
