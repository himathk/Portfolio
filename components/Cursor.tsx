'use client';

import { useEffect, useRef } from 'react';
import { subscribe, pointer, lerp } from '@/lib/motion';

const LABELS: Record<string, string> = { hover: '', view: 'View', mail: 'Say hi' };

export default function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = dot.current;
    const lbl = label.current;
    if (!el) return;

    const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    const targets = [...document.querySelectorAll<HTMLElement>('[data-cursor]')];
    const enter = (e: Event) => {
      const kind = (e.currentTarget as HTMLElement).dataset.cursor ?? '';
      const txt = LABELS[kind] ?? '';
      el.style.width = el.style.height = (txt ? 74 : 44) + 'px';
      el.style.mixBlendMode = txt ? 'normal' : 'difference';
      if (lbl) {
        lbl.textContent = txt;
        lbl.style.opacity = txt ? '1' : '0';
      }
    };
    const leave = () => {
      el.style.width = el.style.height = '14px';
      el.style.mixBlendMode = 'difference';
      if (lbl) lbl.style.opacity = '0';
    };

    targets.forEach((t) => {
      t.addEventListener('mouseenter', enter);
      t.addEventListener('mouseleave', leave);
    });

    const unsubscribe = subscribe(() => {
      pos.x = lerp(pos.x, pointer.px, 0.18);
      pos.y = lerp(pos.y, pointer.py, 0.18);
      el.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%,-50%)`;
    });

    return () => {
      unsubscribe();
      targets.forEach((t) => {
        t.removeEventListener('mouseenter', enter);
        t.removeEventListener('mouseleave', leave);
      });
    };
  }, []);

  return (
    <div className="cursor" id="cursor" ref={dot}>
      <span className="cursor__label" ref={label} />
    </div>
  );
}
