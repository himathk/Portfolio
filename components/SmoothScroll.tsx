'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/** Lenis smooth scroll, driven off the GSAP ticker and wired into ScrollTrigger. */
export default function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lenis = new Lenis({ duration: 1.15, smoothWheel: true, wheelMultiplier: 1 });

    const onScroll = () => ScrollTrigger.update();
    lenis.on('scroll', onScroll);

    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // hand anchor jumps to Lenis so they ease instead of snapping
    const anchors = [...document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
    const onAnchorClick = (e: Event) => {
      const href = (e.currentTarget as HTMLAnchorElement).getAttribute('href');
      if (!href) return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target as HTMLElement, { offset: 0 });
    };
    anchors.forEach((a) => a.addEventListener('click', onAnchorClick));

    return () => {
      anchors.forEach((a) => a.removeEventListener('click', onAnchorClick));
      gsap.ticker.remove(raf);
      lenis.off('scroll', onScroll);
      lenis.destroy();
    };
  }, []);

  return null;
}
