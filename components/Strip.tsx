'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { subscribe } from '@/lib/motion';

gsap.registerPlugin(ScrollTrigger);

export default function Strip() {
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = track.current;
    if (!el) return;

    let x = 0;
    let vel = 0;

    const st = ScrollTrigger.create({
      onUpdate: (self) => {
        vel = self.getVelocity() / 260;
      },
    });

    const unsubscribe = subscribe(() => {
      vel *= 0.93;
      x -= 1.1 + Math.abs(vel);
      // wrap on the offset of the repeated half rather than scrollWidth/2,
      // which would drift because of the flex gap
      const half = (el.children[2] as HTMLElement | undefined)?.offsetLeft ?? 0;
      if (half && Math.abs(x) >= half) x += half;
      el.style.transform = `translate3d(${x}px,0,0)`;
    });

    return () => {
      unsubscribe();
      st.kill();
    };
  }, []);

  return (
    <div className="strip">
      <div className="strip__track" ref={track}>
        <span className="outline">SELECTED WORK</span>
        <span className="fill">SELECTED WORK</span>
        <span className="outline">SELECTED WORK</span>
        <span className="fill">SELECTED WORK</span>
      </div>
    </div>
  );
}
