'use client';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { splitWords, splitChars } from '@/lib/split';

gsap.registerPlugin(ScrollTrigger, useGSAP);

/* Splitting rewrites the DOM, and gsap.context().revert() restores inline
 * styles but not structure, so under StrictMode's double-mount a naive split
 * would nest spans inside already-split spans. These stay idempotent by
 * flagging the element and re-reading the existing pieces on a second pass. */
function ensureWords(el: HTMLElement): HTMLElement[] {
  if (el.dataset.splitDone === '1') {
    return [...el.querySelectorAll<HTMLElement>('.word')];
  }
  const out = splitWords(el);
  el.dataset.splitDone = '1';
  return out;
}

function ensureChars(el: HTMLElement): HTMLElement[] {
  if (el.dataset.splitDone === '1') {
    return [...el.querySelectorAll<HTMLElement>('.line__i')];
  }
  const out = splitChars(el);
  el.dataset.splitDone = '1';
  return out;
}

/* No `scope` on useGSAP here on purpose: these selectors target sections all
 * over the page, and scoping would restrict them to descendants of a ref that
 * owns none of them. Cleanup still reverts everything via the gsap context. */
export default function ScrollAnimations() {
  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document
        .querySelectorAll<HTMLElement>('.manifesto__text')
        .forEach((el) => (el.style.opacity = '1'));
      return;
    }

    // manifesto: word-by-word brightening
    document.querySelectorAll<HTMLElement>('[data-split="words"]').forEach((el) => {
      gsap.to(ensureWords(el), {
        opacity: 1,
        ease: 'none',
        stagger: 0.5,
        scrollTrigger: { trigger: el, start: 'top 78%', end: 'bottom 55%', scrub: 0.6 },
      });
    });

    // section titles: char stagger
    document.querySelectorAll<HTMLElement>('[data-split="chars"]').forEach((el) => {
      gsap.from(ensureChars(el), {
        yPercent: 110,
        duration: 1,
        ease: 'expo.out',
        stagger: 0.035,
        scrollTrigger: { trigger: el, start: 'top 88%' },
      });
    });

    gsap.from('.mcard', {
      yPercent: 22,
      opacity: 0,
      duration: 1,
      ease: 'expo.out',
      stagger: 0.08,
      scrollTrigger: { trigger: '.manifesto__grid', start: 'top 85%' },
    });

    gsap.from('.toolrow', {
      y: 44,
      opacity: 0,
      duration: 0.95,
      ease: 'expo.out',
      stagger: 0.08,
      scrollTrigger: { trigger: '.toolset', start: 'top 82%' },
    });

    gsap.from('.work-row', {
      yPercent: 45,
      opacity: 0,
      duration: 1.1,
      ease: 'expo.out',
      stagger: 0.07,
      scrollTrigger: { trigger: '.worklist', start: 'top 82%' },
    });

    // Pinned horizontal gallery, desktop/tablet only. On touch-sized screens
    // the pin fights native scrolling, so the CSS hands the section a real
    // swipeable overflow container instead.
    const mm = gsap.matchMedia();
    mm.add('(min-width: 901px)', () => {
      const track = document.getElementById('galleryTrack');
      if (!track) return;
      const dist = () => Math.max(0, track.scrollWidth - window.innerWidth + 40);
      gsap.to(track, {
        x: () => -dist(),
        ease: 'none',
        scrollTrigger: {
          trigger: '.gallery',
          start: 'top top',
          end: () => '+=' + dist(),
          pin: '.gallery__pin',
          scrub: 1,
          invalidateOnRefresh: true,
          anticipatePin: 1,
        },
      });
    });

    gsap.to('#tlLine', {
      scaleY: 1,
      ease: 'none',
      scrollTrigger: { trigger: '.timeline', start: 'top 75%', end: 'bottom 85%', scrub: 0.5 },
    });

    gsap.from('.tl-item', {
      y: 50,
      opacity: 0,
      duration: 1,
      ease: 'expo.out',
      stagger: 0.12,
      scrollTrigger: { trigger: '.timeline', start: 'top 78%' },
    });

    gsap.from('.contact__title .line__i', {
      yPercent: 115,
      duration: 1.3,
      ease: 'expo.out',
      stagger: 0.1,
      scrollTrigger: { trigger: '.contact', start: 'top 72%' },
    });

    // Window resize / device rotation leaves the pin spacer at its old width,
    // which shows up as phantom horizontal overflow until a re-measure.
    let resizeTimer = 0;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => ScrollTrigger.refresh(), 180);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      clearTimeout(resizeTimer);
      mm.revert();
    };
  }, []);

  return null;
}
