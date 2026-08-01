'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

const SOCIALS = ['Instagram', 'Dribbble', 'GitHub', 'LinkedIn', 'Read.cv'];

export default function Contact() {
  const magnet = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const el = magnet.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const strength = 0.35;
    const move = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      gsap.to(el, {
        x: (e.clientX - (r.left + r.width / 2)) * strength,
        y: (e.clientY - (r.top + r.height / 2)) * strength * 1.6,
        duration: 0.6,
        ease: 'power3.out',
      });
    };
    const reset = () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1,.35)' });
    };

    el.addEventListener('mousemove', move);
    el.addEventListener('mouseleave', reset);
    return () => {
      el.removeEventListener('mousemove', move);
      el.removeEventListener('mouseleave', reset);
      gsap.killTweensOf(el);
    };
  }, []);

  return (
    <section className="contact" id="contact">
      <p className="mono contact__label">(NEXT)</p>

      <h2 className="contact__title">
        <span className="line">
          <span className="line__i">LET&apos;S MAKE</span>
        </span>
        <span className="line">
          <span className="line__i">
            SOMETHING <em className="serif">loud</em>
          </span>
        </span>
      </h2>

      <a href="mailto:hello@example.com" className="magnet" data-cursor="mail" ref={magnet}>
        <span className="magnet__in">hello@example.com</span>
      </a>

      <ul className="socials mono">
        {SOCIALS.map((s) => (
          <li key={s}>
            {/* TODO: real URLs pending */}
            <a href="#" data-cursor="hover">
              {s}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
