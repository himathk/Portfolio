'use client';

import { useEffect, useRef } from 'react';

/**
 * A silent, looping clip that costs nothing until it is needed: the source is only
 * attached once the video is within a screen of the viewport, and it only plays
 * while actually on screen. Reduced-motion visitors get the poster frame instead.
 */
export default function LoopVideo({
  src,
  poster,
  className,
}: {
  src: string;
  poster: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const attach = () => {
      if (!v.getAttribute('src')) v.src = src;
    };

    const load = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        attach();
        load.disconnect();
      },
      { rootMargin: '100% 0px' },
    );
    load.observe(v);

    // The two observers report independently, so arriving straight onto the video
    // (a jump, a fast fling) can reach this one first: attach here as well, or
    // play() runs against no source, fails, and is never retried.
    const play = new IntersectionObserver(([e]) => {
      if (calm) return;
      if (e.isIntersecting) {
        attach();
        // play() rejects if the element is torn down mid-request; nothing to recover
        v.play().catch(() => {});
      } else v.pause();
    });
    play.observe(v);

    return () => {
      load.disconnect();
      play.disconnect();
    };
  }, [src]);

  return (
    <video
      ref={ref}
      className={className}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      aria-hidden="true"
    />
  );
}
