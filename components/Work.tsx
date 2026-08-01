'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { subscribe, pointer, accent, lerp } from '@/lib/motion';

/** Aegis is pulled out of the list: it is the project the whole site leads with. */
const FEATURED = {
  title: 'Aegis',
  desc: 'Knowledge-graph investigative AI. I led the ML side and designed the interface.',
  role: 'ML Lead & UI/UX',
  yr: '2025-26',
  href: 'https://info.aegisseeker.com',
  art: 'g1',
  accent: '#FF4D1C',
};

const PROJECTS = [
  {
    n: '02',
    title: 'InfoIns',
    cat: 'Insurance Platform · Design & Frontend',
    yr: 'Since 2023',
    art: 'g2',
    accent: '#3EFFC8',
  },
  {
    n: '03',
    title: 'SnapVibe',
    cat: 'Photobooth Web · UI/UX & Frontend',
    yr: '2026',
    art: 'g3',
    accent: '#FF2D78',
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

export default function Work() {
  const preview = useRef<HTMLDivElement>(null);
  const section = useRef<HTMLElement>(null);

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

    // Accent applies to the featured block too, but the floating preview does
    // not: that block already shows its artwork inline.
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

  return (
    <section className="work" id="work" ref={section}>
      <div className="sec-head">
        <span className="rail mono">(WORK)</span>
        <h2 className="sec-title" data-split="chars">
          Projects
        </h2>
        <span className="mono sec-count">Five selected</span>
      </div>

      <a
        className="feature"
        href={FEATURED.href}
        target="_blank"
        rel="noopener noreferrer"
        data-cursor="view"
        data-accent={FEATURED.accent}
      >
        <div className="feature__body">
          <div className="feature__meta mono">
            <span>01 / Featured</span>
            <span>
              {FEATURED.role} · {FEATURED.yr}
            </span>
          </div>
          <h3 className="feature__title">{FEATURED.title}</h3>
          <p className="feature__desc">{FEATURED.desc}</p>
          <span className="feature__cta mono">info.aegisseeker.com ↗</span>
        </div>
        <div className={`feature__art ${FEATURED.art}`} aria-hidden="true" />
      </a>

      <ul className="worklist">
        {PROJECTS.map((p) => (
          <li key={p.n}>
            <div className="work-row" data-art={p.art} data-accent={p.accent} data-cursor="view">
              <span className="work-row__n mono">{p.n}</span>
              <h3 className="work-row__title">{p.title}</h3>
              <span className="work-row__cat mono">{p.cat}</span>
              <span className="work-row__yr mono">{p.yr}</span>
            </div>
          </li>
        ))}
      </ul>

      {/* cursor-following preview */}
      <div className="preview" ref={preview}>
        {PROJECTS.map((p) => (
          <div className={`preview__i ${p.art}`} data-art={p.art} key={p.art} />
        ))}
      </div>
    </section>
  );
}
