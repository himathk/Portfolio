'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { subscribe, pointer, lerp } from '@/lib/motion';

const PROJECTS = [
  { n: '01', title: 'Aegis', cat: 'Investigative AI · ML Lead & UI/UX', yr: '2025—26', art: 'g1' },
  { n: '02', title: 'InfoIns', cat: 'Insurance Platform · Design & Frontend', yr: '2023—Now', art: 'g2' },
  { n: '03', title: 'SnapVibe', cat: 'Photobooth Web · UI/UX & Frontend', yr: '2026', art: 'g3' },
  { n: '04', title: 'JewishChat', cat: 'Community Groups · Lead Designer', yr: '2026', art: 'g4' },
  { n: '05', title: 'Heliez LK', cat: 'Cake Artistry · Design & Dev Lead', yr: '2026', art: 'g5' },
];

export default function Work() {
  const preview = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const pv = preview.current;
    const ul = list.current;
    if (!pv || !ul) return;

    // Centring lives in GSAP's transform (xPercent/yPercent) so the frame loop
    // can own left/top without the two fighting over the same property.
    gsap.set(pv, { xPercent: -50, yPercent: -50, scale: 0.85 });

    const arts = new Map<string, HTMLElement>();
    pv.querySelectorAll<HTMLElement>('.preview__i').forEach((el) => {
      arts.set(el.dataset.art ?? '', el);
    });

    const rows = [...ul.querySelectorAll<HTMLElement>('.work-row')];
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
      rows.forEach((r) => {
        r.removeEventListener('mouseenter', enter);
        r.removeEventListener('mouseleave', leave);
      });
    };
  }, []);

  return (
    <section className="work" id="work">
      <div className="sec-head">
        <span className="rail mono">(WORK)</span>
        <h2 className="sec-title" data-split="chars">
          Projects
        </h2>
        <span className="mono sec-count">05 — Selected</span>
      </div>

      <ul className="worklist" ref={list}>
        {PROJECTS.map((p) => (
          <li className="work-row" data-art={p.art} data-cursor="view" key={p.n}>
            <span className="work-row__n mono">{p.n}</span>
            <h3 className="work-row__title">{p.title}</h3>
            <span className="work-row__cat mono">{p.cat}</span>
            <span className="work-row__yr mono">{p.yr}</span>
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
