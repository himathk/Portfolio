'use client';

import { useEffect, useRef, useState } from 'react';

type Card = {
  n: string;
  title: string;
  credit: string;
  img: string;
  alt: string;
  /** in-page case study the card opens */
  href?: string;
  /** written on the back of the print; cards without one link out instead of turning over */
  note?: string;
};

const CARDS: Card[] = [
  {
    n: '01 / Product',
    title: 'Aegis',
    credit: 'Identity & promo',
    img: '/work/aegis/card.webp',
    alt: 'The Aegis shield logo, from the promo I animated',
    href: '#aegis',
  },
  {
    n: '02 / Fan art poster',
    title: 'Yogeshwari',
    credit: 'For Charitha Attalage',
    img: '/designs/yogeshwari.webp',
    alt: 'Yogeshwari, a fan-art concert poster for Charitha Attalage: two halftone hands reaching for an eye across acid-green type',
    note: 'Two halftone hands reaching for an eye across acid-green type.',
  },
  {
    n: '03 / Fan art poster',
    title: 'Kuweniverse',
    credit: 'For Charitha Attalage',
    img: '/designs/kuweniverse.webp',
    alt: 'Kuweniverse, a fan-art concert poster for Charitha Attalage: an astronaut facing a black hole behind orange type',
    note: 'An astronaut facing a black hole behind orange type.',
  },
  {
    n: '04 / Fan art poster',
    title: 'Alokawarsha',
    credit: 'For Dhanith Sri',
    img: '/designs/alokawarsha.webp',
    alt: 'Alokawarsha, a fan-art concert poster for Dhanith Sri: watercolour whales swimming through a starry sky',
    note: 'Watercolour whales swimming through a starry sky.',
  },
];

export default function Gallery() {
  const track = useRef<HTMLDivElement>(null);
  const [flipped, setFlipped] = useState<string | null>(null);

  // Lift, tilt and foil follow the pointer, which changes every frame, so they
  // live in CSS variables set straight on the element rather than in React state.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const cards = [...el.querySelectorAll<HTMLElement>('.card')];

    const enter = (e: PointerEvent) => {
      el.classList.add('is-focus');
      (e.currentTarget as HTMLElement).classList.add('is-lifted');
    };
    const move = (e: PointerEvent) => {
      const card = e.currentTarget as HTMLElement;
      const print = card.querySelector<HTMLElement>('.print');
      if (!print) return;
      const r = print.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      print.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      print.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
      if (!calm) {
        print.style.setProperty('--ry', `${((x - 0.5) * 14).toFixed(2)}deg`);
        print.style.setProperty('--rx', `${((0.5 - y) * 10).toFixed(2)}deg`);
      }
    };
    const leave = (e: PointerEvent) => {
      const card = e.currentTarget as HTMLElement;
      card.classList.remove('is-lifted');
      el.classList.remove('is-focus');
      const print = card.querySelector<HTMLElement>('.print');
      print?.style.removeProperty('--rx');
      print?.style.removeProperty('--ry');
    };

    cards.forEach((c) => {
      c.addEventListener('pointerenter', enter);
      c.addEventListener('pointermove', move);
      c.addEventListener('pointerleave', leave);
    });
    return () => {
      cards.forEach((c) => {
        c.removeEventListener('pointerenter', enter);
        c.removeEventListener('pointermove', move);
        c.removeEventListener('pointerleave', leave);
      });
    };
  }, []);

  // Escape turns a print back over, the way it closes everything else on the page
  useEffect(() => {
    if (!flipped) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFlipped(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flipped]);

  return (
    <section className="gallery" id="designs">
      <div className="gallery__pin">
        <div className="gallery__track" id="galleryTrack" ref={track}>
          <div className="gallery__intro">
            <span className="rail mono">(DESIGNS)</span>
            <h2 className="gallery__title">
              Visual
              <br />
              <em className="serif">work</em>
            </h2>
            <p className="mono">Product work and poster art. Turn a print over. Keep scrolling →</p>
          </div>

          {CARDS.map((c) => {
            const isFlipped = flipped === c.title;
            return (
              <figure className="card" key={c.title}>
                <div className={`print${isFlipped ? ' is-flipped' : ''}`}>
                  <div className="print__body">
                    <div className="print__face print__front">
                      <div className="print__art">
                        <img src={c.img} alt={c.alt} width={1000} height={1414} loading="lazy" />
                        <i className="print__foil" aria-hidden="true" />
                        <i className="print__shine" aria-hidden="true" />
                      </div>
                    </div>
                    {/* the back restates the caption and the image description, so
                        screen readers already have it from those */}
                    {c.note && (
                      <div className="print__face print__back" aria-hidden="true">
                        {/* the front showing through the paper, mirrored, the way ink does */}
                        <img className="print__ghost" src={c.img} alt="" width={1000} height={1414} loading="lazy" />
                        <span className="print__back-top mono">
                          <span>{c.n}</span>
                          <span className="print__seal">HK</span>
                        </span>
                        <span className="print__back-title">{c.title}</span>
                        <span className="print__back-credit mono">{c.credit}</span>
                        <span className="print__back-note serif">{c.note}</span>
                      </div>
                    )}
                  </div>

                  {c.note ? (
                    <button
                      type="button"
                      className="print__hit"
                      aria-pressed={isFlipped}
                      aria-label={`Turn over the ${c.title} print`}
                      data-cursor="flip"
                      onClick={() => setFlipped(isFlipped ? null : c.title)}
                    />
                  ) : (
                    c.href && (
                      // laid over the whole print: a figcaption can't sit inside a link
                      <a className="print__hit" href={c.href} data-cursor="view" aria-label={`Open the ${c.title} case study`} />
                    )
                  )}
                </div>

                <figcaption className="card__cap">
                  <span className="mono">{c.n}</span>
                  <h4>{c.title}</h4>
                  <span className="mono card__credit">{c.credit}</span>
                  {c.note && (
                    <span className="mono card__hint" aria-hidden="true">
                      Tap to turn over
                    </span>
                  )}
                </figcaption>
              </figure>
            );
          })}

          <div className="gallery__end">
            <h3 className="serif">
              and
              <br />
              more.
            </h3>
          </div>
        </div>
      </div>
    </section>
  );
}
