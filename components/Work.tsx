'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { subscribe, pointer, accent, lerp } from '@/lib/motion';
import AegisCase, { AegisOpening, AegisEnd } from '@/components/AegisCase';
import SnapVibe from '@/components/SnapVibe';

gsap.registerPlugin(ScrollTrigger, useGSAP);

type Project = {
  n: string;
  title: string;
  cat: string;
  yr: string;
  art: string;
  accent: string;
  /** has an in-page case study the row expands into */
  caseStudy?: boolean;
  /** has a live window below the case study to try the real product in */
  live?: boolean;
};

const PROJECTS: Project[] = [
  {
    n: '01',
    title: 'Aegis',
    cat: 'Investigative AI · Lead, ML & UI/UX',
    yr: '2025-26',
    art: 'aegis',
    accent: '#5B8CFF',
    caseStudy: true,
  },
  {
    n: '02',
    title: 'SnapVibe',
    cat: 'Event Photo Booth · Solo Design & Build',
    yr: '2026',
    art: 'snapvibe',
    accent: '#D4AF37',
    live: true,
  },
  {
    n: '03',
    title: 'InfoIns',
    cat: 'Insurance Platform · Design & Frontend',
    yr: 'Since 2023',
    art: 'g2',
    accent: '#3EFFC8',
  },
  {
    n: '04',
    title: 'JewishChat',
    cat: 'Community Groups · Lead Designer',
    yr: '2026',
    art: 'g4',
    accent: '#4CC9FF',
  },
  {
    n: '05',
    title: 'Heliez LK',
    cat: 'Cake Artistry · Design & Dev Lead',
    yr: '2026',
    art: 'g5',
    accent: '#FFB03E',
  },
];

/** The list appears twice: once before the case study as the index it grows out
 *  of, and once after as the list it folds back into, with Aegis marked viewed. */
function WorkList({ after = false }: { after?: boolean }) {
  return (
    <ul className="worklist">
      {PROJECTS.map((p) => {
        const tag = p.caseStudy ? (after ? 'Viewed' : 'Case study ↓') : p.live ? 'Try it live ↓' : null;
        const inner = (
          <>
            <span className="work-row__n mono">{p.n}</span>
            <h3 className="work-row__title">
              {p.title}
              {tag && <span className={`work-row__tag mono${p.live ? ' work-row__tag--live' : ''}`}>{tag}</span>}
            </h3>
            <span className="work-row__cat mono">{p.cat}</span>
            <span className="work-row__yr mono">{p.yr}</span>
          </>
        );
        const shared = { 'data-art': p.art, 'data-accent': p.accent, 'data-cursor': 'view' };
        return (
          <li key={p.n} className={p.caseStudy ? 'is-case' : undefined}>
            {p.caseStudy && !after ? (
              <a className="work-row" href="#aegis" data-case {...shared}>
                {inner}
              </a>
            ) : p.live ? (
              // the second list is aria-hidden, so its link stays out of the tab order
              <a className="work-row" href="#snapvibe" tabIndex={after ? -1 : undefined} {...shared}>
                {inner}
              </a>
            ) : (
              <div className="work-row" data-case={p.caseStudy || undefined} {...shared}>
                {inner}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function Work() {
  const preview = useRef<HTMLDivElement>(null);
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const openPanel = useRef<HTMLDivElement>(null);
  const stageAfter = useRef<HTMLDivElement>(null);
  const closePanel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pv = preview.current;
    const sec = section.current;
    if (!pv || !sec) return;

    // Centring lives in GSAP's transform (xPercent/yPercent) so the frame loop
    // can own left/top without the two fighting over the same property.
    gsap.set(pv, { xPercent: -50, yPercent: -50, scale: 0.85 });

    const arts = new Map<string, HTMLElement>();
    pv.querySelectorAll<HTMLElement>('.preview__i').forEach((el) => {
      arts.set(el.dataset.art ?? '', el);
    });

    const tinted = [...sec.querySelectorAll<HTMLElement>('[data-accent]')];
    const tintOn = (e: Event) => {
      accent.hex = (e.currentTarget as HTMLElement).dataset.accent ?? null;
    };
    const tintOff = () => {
      accent.hex = null;
    };
    tinted.forEach((el) => {
      el.addEventListener('mouseenter', tintOn);
      el.addEventListener('mouseleave', tintOff);
    });

    const rows = [...sec.querySelectorAll<HTMLElement>('.work-row')];
    const enter = (e: Event) => {
      const art = arts.get((e.currentTarget as HTMLElement).dataset.art ?? '');
      if (!art) return;
      gsap.to(pv, { opacity: 1, scale: 1, duration: 0.55, ease: 'expo.out' });
      gsap.to([...arts.values()], { opacity: 0, duration: 0.3 });
      gsap.to(art, { opacity: 1, duration: 0.45 });
      gsap.fromTo(art, { scale: 1.25 }, { scale: 1, duration: 1.1, ease: 'expo.out' });
    };
    const leave = () => {
      gsap.to(pv, { opacity: 0, duration: 0.35, ease: 'power2.out' });
    };
    rows.forEach((r) => {
      r.addEventListener('mouseenter', enter);
      r.addEventListener('mouseleave', leave);
    });

    const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const unsubscribe = subscribe(() => {
      // more drag than the cursor so the frame trails behind it
      pos.x = lerp(pos.x, pointer.px, 0.09);
      pos.y = lerp(pos.y, pointer.py, 0.09);
      pv.style.left = pos.x + 'px';
      pv.style.top = pos.y + 'px';
    });

    return () => {
      unsubscribe();
      tinted.forEach((el) => {
        el.removeEventListener('mouseenter', tintOn);
        el.removeEventListener('mouseleave', tintOff);
      });
      rows.forEach((r) => {
        r.removeEventListener('mouseenter', enter);
        r.removeEventListener('mouseleave', leave);
      });
      accent.hex = null;
    };
  }, []);

  useGSAP(() => {
    const st = stage.current;
    const open = openPanel.current;
    const after = stageAfter.current;
    const close = closePanel.current;
    if (!st || !open || !after || !close) return;

    // The panel's clip, in the stage's own coordinates, that exactly covers the
    // stage's case-study row. Measured from layout offsets, not rects: the rows
    // enter with a transform that may still be applied when this is measured.
    const rowClip = (scope: HTMLElement) => {
      const row = scope.querySelector<HTMLElement>('[data-case]')!;
      let top = 0;
      let left = 0;
      for (let n: HTMLElement | null = row; n && n !== scope; n = n.offsetParent as HTMLElement | null) {
        top += n.offsetTop;
        left += n.offsetLeft;
      }
      const right = scope.clientWidth - left - row.offsetWidth;
      const bottom = scope.clientHeight - top - row.offsetHeight;
      return `inset(${top}px ${right}px ${bottom}px ${left}px)`;
    };
    const FULL = 'inset(0px 0px 0px 0px)';

    const mm = gsap.matchMedia();

    mm.add('(min-width: 901px) and (prefers-reduced-motion: no-preference)', () => {
      // Grow: the list holds still while the Aegis row opens into a full screen.
      // Pins are refreshed before the chapters' triggers below them, which were
      // created first (child effects run before this one) and need the pin spacing.
      gsap
        .timeline({
          scrollTrigger: {
            trigger: st,
            start: 'top top',
            end: '+=120%',
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
            // highest: the screens carousel (2) and fold-back (1) sit below it
            refreshPriority: 3,
          },
        })
        .fromTo(open, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.1, ease: 'none' }, 0)
        .fromTo(open, { clipPath: () => rowClip(st) }, { clipPath: FULL, duration: 0.6, ease: 'power2.inOut' }, 0.06)
        .to(st.querySelectorAll('.worklist li:not(.is-case)'), { opacity: 0.15, duration: 0.45 }, 0.06)
        .fromTo(
          open.querySelector('.case-open__inner'),
          { y: 60, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.25, ease: 'power2.out' },
          0.55,
        )
        .to({}, { duration: 0.15 });

      // Fold back: the end card arrives full screen, then shrinks into the Aegis row
      // of the second list and dissolves, leaving the row marked as viewed.
      gsap
        .timeline({
          scrollTrigger: {
            trigger: after,
            start: 'top top',
            end: '+=100%',
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
            refreshPriority: 1,
          },
        })
        .fromTo(close, { clipPath: FULL }, { clipPath: () => rowClip(after), duration: 0.6, ease: 'power2.inOut' }, 0.1)
        .fromTo(after.querySelectorAll('.worklist li:not(.is-case)'), { opacity: 0.15 }, { opacity: 1, duration: 0.4 }, 0.3)
        .to(close, { autoAlpha: 0, duration: 0.15 }, 0.72)
        .to({}, { duration: 0.13 });
    });

    // Phones: nothing pins (it fights native touch scrolling), so the opening
    // panel just widens into the full frame as it scrolls into view.
    mm.add('(max-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(
        open,
        { clipPath: 'inset(6% 5% 6% 5%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', scrollTrigger: { trigger: open, start: 'top bottom', end: 'top 25%', scrub: true } },
      );
    });

    return () => mm.revert();
  });

  return (
    <section className="work" id="work" ref={section}>
      <div className="sec-head">
        <span className="rail mono">(WORK)</span>
        <h2 className="sec-title" data-split="chars">
          Projects
        </h2>
        <span className="mono sec-count">Five selected</span>
      </div>

      <div className="work-stage" ref={stage}>
        <WorkList />
        <div className="case-panel" ref={openPanel}>
          <AegisOpening />
        </div>
      </div>

      <AegisCase />

      {/* visual device only: this list repeats the one above, and the end card is decorative */}
      <div className="work-stage work-stage--after" ref={stageAfter} aria-hidden="true">
        <WorkList after />
        <div className="case-panel" ref={closePanel}>
          <AegisEnd />
        </div>
      </div>

      <SnapVibe />

      {/* cursor-following preview */}
      <div className="preview" ref={preview}>
        {PROJECTS.map((p) => (
          <div className={`preview__i ${p.art}`} data-art={p.art} key={p.art} />
        ))}
      </div>
    </section>
  );
}
