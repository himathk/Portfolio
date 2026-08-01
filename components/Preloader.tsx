'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const WORDS = ['MOTION', 'CODE', 'CRAFT'];

export default function Preloader() {
  const root = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLElement>(null);
  const pct = useRef<HTMLSpanElement>(null);
  const words = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loader = root.current;
    const wordsEl = words.current;
    if (!loader || !wordsEl) return;

    const release = () => {
      document.body.classList.remove('is-loading');
      ScrollTrigger.refresh();
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      loader.style.display = 'none';
      release();
      return;
    }

    // safety net: a backgrounded tab pauses rAF, which would stall the timeline
    // and leave the page scroll-locked. Force the page open if that happens.
    const bail = window.setTimeout(() => {
      if (document.body.classList.contains('is-loading')) {
        gsap.set(loader, { display: 'none' });
        gsap.set('.hero__title .line__i, [data-anim="fade"], .ticker', { clearProps: 'all' });
        release();
      }
    }, 9000);

    // No scope element: the hand-off animates the hero, which lives outside
    // this component. Scoping to `root` would silently match nothing.
    const ctx = gsap.context(() => {
      const lineH = (wordsEl.firstElementChild as HTMLElement).offsetHeight;
      // derived from the markup so adding/removing a word can't desync the steps
      const steps = Math.max(1, wordsEl.children.length - 1);
      const counter = { v: 0 };

      const tl = gsap.timeline();

      tl.to(wordsEl, { y: -lineH * steps, duration: 2, ease: `steps(${steps})` }, 0)
        .to(
          counter,
          {
            v: 100,
            duration: 2,
            ease: 'power1.inOut',
            onUpdate() {
              const n = Math.round(counter.v);
              if (pct.current) pct.current.textContent = String(n).padStart(3, '0');
              if (bar.current) bar.current.style.width = n + '%';
            },
          },
          0,
        )
        .to('.loader__curtain', { y: '0%', duration: 0.8, ease: 'expo.inOut' }, '>-0.1')
        .set(loader, { className: 'loader is-done' })
        .to(loader, { yPercent: -100, duration: 1, ease: 'expo.inOut' }, '>0.15')
        .add(() => {
          clearTimeout(bail);
          release();
        }, '<')
        .from('.hero__title .line__i', {
          yPercent: 115,
          duration: 1.25,
          ease: 'expo.out',
          stagger: 0.09,
        }, '<0.15')
        .from('[data-anim="fade"]', {
          y: 26,
          opacity: 0,
          duration: 0.9,
          ease: 'power3.out',
          stagger: 0.12,
        }, '<0.3')
        .from('.ticker', { yPercent: 100, duration: 0.9, ease: 'expo.out' }, '<0.1')
        .set(loader, { display: 'none' });
    });

    return () => {
      clearTimeout(bail);
      ctx.revert();
      document.body.classList.remove('is-loading');
    };
  }, []);

  return (
    <div className="loader" id="loader" ref={root}>
      <div className="loader__inner">
        <div className="loader__row">
          <span className="mono">[ INITIALISING ]</span>
          <span className="mono loader__pct" ref={pct}>
            000
          </span>
        </div>
        <div className="loader__bar">
          <i ref={bar} />
        </div>
        <div className="loader__words" ref={words}>
          {WORDS.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
      </div>
      <div className="loader__curtain" />
    </div>
  );
}
