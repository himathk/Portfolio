'use client';

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import LoopVideo from '@/components/LoopVideo';
import WatchButton from '@/components/WatchButton';
import { play } from '@/lib/sfx';

gsap.registerPlugin(ScrollTrigger);

/* The Aegis case study on one wall instead of fourteen screens of scroll: the
 * case file, the four chapters as index cards, two prints and a contact sheet,
 * joined by red string. Any exhibit opens up close; review all seven and the
 * case gets stamped closed and the string closes its loop.
 */

const MEDIA = '/work/aegis';
const TRAILER_ID = 'opLe1FIWPz8';
const PROMO_ID = 'Ymumnz8YVtU';

/* Entity tags, in the categories Aegis itself extracts. Tagged text lights up as
   it scrolls in: the page runs a staged version of Aegis itself. */
type Kind = 'person' | 'location' | 'org' | 'date' | 'number';
const KIND_LABEL: Record<Kind, string> = {
  person: 'Person',
  location: 'Location',
  org: 'Organization',
  date: 'DateTime',
  number: 'Number',
};

function Ent({ k, children }: { k: Kind; children: ReactNode }) {
  return (
    <span className={`ent ent--${k}`} data-label={KIND_LABEL[k]}>
      {children}
    </span>
  );
}

type Exhibit = {
  id: string;
  letter: string;
  /** what the board shows */
  thumb: string;
  /** what opens up close: a still, or a silent loop of one of the films */
  media: { kind: 'image'; src: string; w: number; h: number } | { kind: 'video'; src: string; poster: string };
  alt: string;
  caption: ReactNode;
  watch?: { id: string; label: string; title: string };
};

const EXHIBITS: Exhibit[] = [
  {
    id: 'still',
    letter: 'A',
    thumb: `${MEDIA}/trailer-board.webp`,
    media: { kind: 'video', src: `${MEDIA}/trailer-loop.mp4`, poster: `${MEDIA}/trailer-poster.webp` },
    alt: 'An investigator at a desk at night, head in hand, under a whiteboard of unanswered connections',
    caption: (
      <>
        From the Aegis trailer, directed, shot and edited by <Ent k="person">Himath Kariyawasam</Ent>, who also plays the lead.
      </>
    ),
    watch: { id: TRAILER_ID, label: 'Watch the trailer', title: 'Aegis trailer' },
  },
  {
    id: 'promo',
    letter: 'B',
    thumb: `${MEDIA}/promo-poster.webp`,
    media: { kind: 'video', src: `${MEDIA}/promo.mp4`, poster: `${MEDIA}/promo-poster.webp` },
    alt: 'The Aegis promo',
    caption: <>The promo. I designed and animated it.</>,
    watch: { id: PROMO_ID, label: 'Watch with sound', title: 'Aegis promo' },
  },
  {
    id: 'login',
    letter: 'C',
    thumb: `${MEDIA}/screen-login.webp`,
    media: { kind: 'image', src: `${MEDIA}/screen-login.webp`, w: 1920, h: 912 },
    alt: 'Aegis login screen',
    caption: (
      <>
        The front door. Built for <Ent k="location">Sri Lankan</Ent> law enforcement, where every session is authenticated and
        logged.
      </>
    ),
  },
  {
    id: 'dashboard',
    letter: 'D',
    thumb: `${MEDIA}/screen-dashboard.webp`,
    media: { kind: 'image', src: `${MEDIA}/screen-dashboard.webp`, w: 1920, h: 2502 },
    alt: 'Aegis dashboard screen',
    caption: <>The command centre: cases, evidence and every relationship the system has found, in one view.</>,
  },
  {
    id: 'evidence',
    letter: 'E',
    thumb: `${MEDIA}/screen-evidence.webp`,
    media: { kind: 'image', src: `${MEDIA}/screen-evidence.webp`, w: 1920, h: 912 },
    alt: 'Aegis evidence management screen',
    caption: <>Entity extraction, the part I built. Every uploaded document comes back with its entities tagged and ready to link.</>,
  },
  {
    id: 'case',
    letter: 'F',
    thumb: `${MEDIA}/screen-case.webp`,
    media: { kind: 'image', src: `${MEDIA}/screen-case.webp`, w: 1920, h: 1014 },
    alt: 'Aegis case management screen',
    caption: <>Every entity becomes a node. The multi-modal knowledge graph shows how a case connects.</>,
  },
  {
    id: 'staff',
    letter: 'G',
    thumb: `${MEDIA}/screen-staff.webp`,
    media: { kind: 'image', src: `${MEDIA}/screen-staff.webp`, w: 1920, h: 997 },
    alt: 'Aegis staff management screen',
    caption: <>Staff and role management, with each officer&apos;s caseload at a glance.</>,
  },
];

/** the contact sheet holds exhibits C to G */
const FRAMES = [2, 3, 4, 5, 6];

const CREDITS: [string, string][] = [
  ['Machine learning', 'entity extraction'],
  ['UI/UX', 'every screen'],
  ['Motion', 'the promo'],
  ['Film', 'directed, shot, edited, starred'],
];

/* -------------------------------------------------------------------------
 * Where everything is pinned, in board units. The wall is BOARD_W x BOARD_H of
 * them and scales as one piece (--u in .board__wall), so the layout, the string
 * and the pins are fixed numbers rather than measurements. r tilts an item about
 * the middle of its top edge, the line its two pins sit on.
 * ---------------------------------------------------------------------- */
const BOARD_W = 1400;
const BOARD_H = 820; // keep in step with .board__wall

type Spot = { x: number; y: number; w: number; r: number };
const SPOT = {
  file: { x: 40, y: 52, w: 452, r: -0.7 },
  c1: { x: 530, y: 70, w: 286, r: -1.6 },
  still: { x: 852, y: 44, w: 508, r: 1.2 },
  c2: { x: 1078, y: 424, w: 282, r: -1 },
  promo: { x: 758, y: 434, w: 290, r: 1.5 },
  sheet: { x: 369, y: 440, w: 360, r: -1.1 },
  c4: { x: 40, y: 428, w: 300, r: 0.9 },
  note: { x: 784, y: 654, w: 250, r: -2.6 },
} satisfies Record<string, Spot>;
type SpotId = keyof typeof SPOT;

const PIN_IN = 20; // in from the side edges
const PIN_DOWN = 14; // down from the top edge

/** A pin's place on the wall: the tilt turns the item about its top centre. */
function pinAt(id: SpotId, side: -1 | 1) {
  const s = SPOT[id];
  const a = (s.r * Math.PI) / 180;
  const dx = side * (s.w / 2 - PIN_IN);
  return {
    x: s.x + s.w / 2 + dx * Math.cos(a) - PIN_DOWN * Math.sin(a),
    y: s.y + dx * Math.sin(a) + PIN_DOWN * Math.cos(a),
  };
}

/** A length of string between two pins: a span across sags, a drop down a side bows out. */
function strand(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  let cx = (a.x + b.x) / 2;
  let cy = (a.y + b.y) / 2;
  if (Math.abs(dy) > Math.abs(dx)) cx += (cx < BOARD_W / 2 ? -1 : 1) * Math.min(24, len * 0.05);
  else cy += Math.min(30, 8 + len * 0.12);
  const f = (n: number) => n.toFixed(1);
  return `M${f(a.x)} ${f(a.y)}Q${f(cx)} ${f(cy)} ${f(b.x)} ${f(b.y)}`;
}

/* The string runs clockwise round the case in story order: the file, the
   problem, the trailer still, down the right edge to the product, the promo,
   the system, and what I did. One length crosses between the two films, and
   the last one, back up to the file, only goes on once the case is closed. */
const RUN: [SpotId, -1 | 1, SpotId, -1 | 1][] = [
  ['file', 1, 'c1', -1],
  ['c1', 1, 'still', -1],
  ['still', 1, 'c2', 1],
  ['c2', -1, 'promo', 1],
  ['promo', -1, 'sheet', 1],
  ['sheet', -1, 'c4', 1],
  ['still', -1, 'promo', 1],
  ['c4', -1, 'file', -1],
];
const STRANDS = RUN.map(([a, sa, b, sb], k) => ({
  a,
  b,
  d: strand(pinAt(a, sa), pinAt(b, sb)),
  closing: k === RUN.length - 1,
}));
const PINS = (Object.keys(SPOT) as SpotId[])
  .filter((id) => id !== 'note')
  .flatMap((id) => [{ id: `${id}-l`, ...pinAt(id, -1) }, { id: `${id}-r`, ...pinAt(id, 1) }]);

const spot = (id: SpotId): CSSProperties => {
  const s = SPOT[id];
  return { '--x': s.x, '--y': s.y, '--w': s.w, '--r': `${s.r}deg` } as CSSProperties;
};

/* a grease-pencil ring: one loose loop that overshoots where it started */
const RING = 'M14 32C4 18 30 5 58 5C84 5 98 17 95 30C92 44 62 48 36 46C14 44 1 34 9 21C13 14 22 10 31 8';

export default function EvidenceBoard() {
  const wall = useRef<HTMLDivElement>(null);
  const stampRef = useRef<HTMLSpanElement>(null);
  const loupe = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(-1);
  const [seen, setSeen] = useState<Set<number>>(() => new Set());
  const [hot, setHot] = useState<SpotId | null>(null);
  // state, not a classList toggle: React owns the wall's className and would drop it
  const [strung, setStrung] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const closed = seen.size === EXHIBITS.length;

  /* -- entrance: things get pinned up, the string runs, the tags light -- */
  useEffect(() => {
    const w = wall.current;
    if (!w) return;
    w.querySelectorAll<HTMLElement>('[data-ents]').forEach((p) =>
      p.querySelectorAll<HTMLElement>('.ent').forEach((e, i) => e.style.setProperty('--d', `${i * 140}ms`)),
    );
    const reveal = () => setStrung(true);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      reveal();
      return;
    }
    const ctx = gsap.context(() => {
      const items = gsap.utils.toArray<HTMLElement>('.bitem', w);
      gsap.set(items, { autoAlpha: 0, y: -26 });
      ScrollTrigger.create({
        trigger: w,
        start: 'top 72%',
        once: true,
        onEnter: () => {
          gsap.to(items, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'back.out(1.8)', stagger: 0.06, clearProps: 'transform,opacity,visibility' });
          gsap.delayedCall(0.35, reveal);
        },
      });
    }, w);
    return () => ctx.revert();
  }, []);

  /* -- the case closes when the last exhibit has been looked at -- */
  const wasClosed = useRef(false);
  useEffect(() => {
    if (!closed || wasClosed.current) return;
    wasClosed.current = true;
    const s = stampRef.current;
    if (!s) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(s, { autoAlpha: 1, rotation: -11 });
      return;
    }
    gsap.delayedCall(0.18, () => play('stamp'));
    gsap
      .timeline({ delay: 0.25 })
      .fromTo(s, { autoAlpha: 0, scale: 2.2, rotation: -20 }, { autoAlpha: 1, scale: 1, rotation: -11, duration: 0.22, ease: 'power4.in' })
      .fromTo(s, { scale: 1.07 }, { scale: 1, duration: 0.45, ease: 'elastic.out(1,0.45)' });
  }, [closed]);

  const inspect = (i: number, from?: HTMLElement | null) => {
    if (from) opener.current = from;
    loupe.current?.classList.remove('is-on');
    setOpen(i);
    setSeen((prev) => (prev.has(i) ? prev : new Set(prev).add(i)));
    play('flip');
  };
  const close = () => {
    setOpen(-1);
    opener.current?.focus();
  };

  /* -- the loupe: hold it over a frame on the contact sheet to read it -- */
  const lastSrc = useRef('');
  const moveLoupe = (e: ReactPointerEvent<HTMLDivElement>) => {
    const l = loupe.current;
    if (!l || e.pointerType !== 'mouse') return;
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.frame');
    const ex = btn ? EXHIBITS[Number(btn.dataset.i)] : null;
    if (!btn || !ex || ex.media.kind !== 'image') {
      l.classList.remove('is-on');
      return;
    }
    const { w: iw, h: ih, src } = ex.media;
    const fw = btn.clientWidth;
    const fh = btn.clientHeight;
    // the frame shows the image cover-fitted from the top, as the CSS does
    const s = Math.max(fw / iw, fh / ih);
    const offX = (fw - iw * s) / 2;
    const zoom = 3;
    const d = l.offsetWidth;
    const { offsetX: lx, offsetY: ly } = e.nativeEvent; // local to the frame: its image ignores the pointer
    const cell = btn.parentElement as HTMLElement;
    if (lastSrc.current !== src) {
      l.style.backgroundImage = `url(${src})`;
      lastSrc.current = src;
    }
    l.style.backgroundSize = `${iw * s * zoom}px ${ih * s * zoom}px`;
    l.style.backgroundPosition = `${d / 2 - (lx - offX) * zoom}px ${d / 2 - ly * zoom}px`;
    l.style.transform = `translate(${cell.offsetLeft + btn.offsetLeft + lx - d / 2}px, ${cell.offsetTop + btn.offsetTop + ly - d / 2}px)`;
    l.classList.add('is-on');
  };
  const hideLoupe = () => loupe.current?.classList.remove('is-on');

  const heat = (id: SpotId) => ({ onPointerEnter: () => setHot(id), onPointerLeave: () => setHot(null) });

  const print = (i: number) => {
    const ex = EXHIBITS[i];
    const id = ex.id as SpotId;
    return (
      <button
        type="button"
        className={`bitem exhibit exhibit--${ex.id}${seen.has(i) ? ' is-seen' : ''}`}
        style={spot(id)}
        data-cursor="view"
        aria-label={`Inspect exhibit ${ex.letter}: ${ex.alt}`}
        onClick={(e) => inspect(i, e.currentTarget)}
        {...heat(id)}
      >
        <span className="exhibit__photo">
          <img src={ex.thumb} alt="" loading="lazy" />
          {ex.media.kind === 'video' && <span className="exhibit__play" aria-hidden="true" />}
        </span>
        <span className="mono exhibit__tag">Exhibit {ex.letter}</span>
        <span className="exhibit__logged mono" aria-hidden="true">
          Logged
        </span>
      </button>
    );
  };

  const card = (id: 'c1' | 'c2' | 'c4', label: string, title: ReactNode, body: ReactNode) => (
    <article className={`bitem ecard ecard--${id}`} style={spot(id)} {...heat(id)}>
      <span className="mono ecard__label">{label}</span>
      <h4 className="ecard__title">{title}</h4>
      {body}
    </article>
  );

  return (
    <article className="board" id="aegis" aria-label="Aegis case study">
      <div className={`board__wall${strung ? ' is-strung is-tagged' : ''}${closed ? ' is-closed' : ''}`} ref={wall}>
        <header className="bitem casefile" style={spot('file')} {...heat('file')}>
          <span className="mono casefile__no">Case 01 · Investigative AI</span>
          <h3 className="casefile__title">Aegis</h3>
          <p className="casefile__sub">Automated evidence and graph intelligence for Sri Lankan law enforcement.</p>
          <dl className="casefile__meta mono">
            <div className="casefile__role">
              <dt>Role</dt>
              <dd>Team lead · ML · UI/UX · Film</dd>
            </div>
            <div>
              <dt>Team</dt>
              <dd>6 people</dd>
            </div>
            <div>
              <dt>Year</dt>
              <dd>2025-26</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>Deployed</dd>
            </div>
          </dl>
          <WatchButton id={TRAILER_ID} label="Watch the trailer" title="Aegis trailer" />
          <span className="stamp casefile__stamp" ref={stampRef} aria-hidden="true">
            Case closed
          </span>
        </header>

        {card(
          'c1',
          '01 / The problem',
          'The answer is already in the files. Nobody has time to find it.',
          <p className="ecard__body">
            Call records, immigration logs, flight manifests, statements. The link that cracks a case is split across all of
            them.
          </p>,
        )}

        {print(0)}

        {card(
          'c2',
          '02 / The product',
          'Aegis reads the evidence, so the investigator can read the case.',
          <p className="ecard__body" data-ents>
            Upload anything. Aegis pulls out every <Ent k="person">person</Ent>, <Ent k="location">place</Ent>,{' '}
            <Ent k="org">organisation</Ent> and <Ent k="date">date</Ent> and links them into one knowledge graph.
          </p>,
        )}

        {print(1)}

        <div className="bitem sheet" style={spot('sheet')} {...heat('sheet')}>
          <span className="mono ecard__label">03 / The system</span>
          <h4 className="ecard__title">Five screens from the deployed system. I designed every one.</h4>
          <div className="sheet__film" onPointerMove={moveLoupe} onPointerLeave={hideLoupe}>
            {FRAMES.map((i) => {
              const ex = EXHIBITS[i];
              return (
                <div className={`sheet__cell${seen.has(i) ? ' is-seen' : ''}`} key={ex.id}>
                  <button
                    type="button"
                    className="frame"
                    data-i={i}
                    data-cursor="hover"
                    aria-label={`Inspect exhibit ${ex.letter}: ${ex.alt}`}
                    onClick={(e) => inspect(i, e.currentTarget)}
                  >
                    <img src={ex.thumb} alt="" loading="lazy" />
                  </button>
                  <span className="mono sheet__no" aria-hidden="true">
                    {ex.letter}
                  </span>
                  <svg className="sheet__ring" viewBox="0 0 100 50" preserveAspectRatio="none" aria-hidden="true">
                    <path d={RING} pathLength={1} />
                  </svg>
                </div>
              );
            })}
            <span className="mono sheet__edge" aria-hidden="true">
              Aegis
              <br />
              Roll 03
            </span>
            <span className="sheet__loupe" ref={loupe} aria-hidden="true" />
          </div>
        </div>

        {card(
          'c4',
          '04 / What I did',
          'I led it end to end.',
          <>
            <p className="ecard__body" data-ents>
              A team of <Ent k="number">six</Ent>, from first sketch to deployment.
            </p>
            <dl className="ecard__credits mono">
              {CREDITS.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <a className="ecard__link mono" href="https://info.aegisseeker.com" target="_blank" rel="noopener noreferrer" data-cursor="hover">
              info.aegisseeker.com ↗
            </a>
          </>,
        )}

        <aside className="bitem bnote" style={spot('note')} aria-label="Case progress">
          <p className="serif bnote__hint">Open any exhibit to inspect it. Review all seven to close the case.</p>
          <p className="mono bnote__count" aria-live="polite">
            Reviewed {seen.size} / {EXHIBITS.length}
          </p>
          <span className="bnote__ticks" aria-hidden="true">
            {EXHIBITS.map((ex, i) => (
              <i key={ex.id} className={seen.has(i) ? 'is-on' : undefined} />
            ))}
          </span>
        </aside>

        {/* the string and its pins, over everything pinned up */}
        <svg className="board__string" viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <radialGradient id="board-pin" cx="36%" cy="32%" r="72%">
              <stop offset="0" stopColor="#ff9a80" />
              <stop offset=".42" stopColor="#d6402b" />
              <stop offset="1" stopColor="#6e140b" />
            </radialGradient>
          </defs>
          {STRANDS.map((s, k) => (
            <path
              key={s.a + s.b}
              d={s.d}
              pathLength={1}
              className={[s.closing && 'is-closing', (hot === s.a || hot === s.b) && 'is-hot'].filter(Boolean).join(' ') || undefined}
              style={{ '--d': s.closing ? '0.5s' : `${k * 0.14}s` } as CSSProperties}
            />
          ))}
          {PINS.map((p, k) => (
            <circle key={p.id} cx={p.x} cy={p.y} r={6.5} fill="url(#board-pin)" style={{ '--d': `${k * 0.04}s` } as CSSProperties} />
          ))}
        </svg>
      </div>

      {open >= 0 && <Inspector index={open} onClose={close} onGo={(i) => inspect(i)} />}
    </article>
  );
}

/** An exhibit up close, over everything, with the next and previous ones a key away. */
function Inspector({ index, onClose, onGo }: { index: number; onClose: () => void; onGo: (i: number) => void }) {
  const ex = EXHIBITS[index];
  const closer = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const go = (d: number) => onGo((index + d + EXHIBITS.length) % EXHIBITS.length);

  useEffect(() => {
    closer.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      // the trailer player opens over this; its own Escape closes it, not both
      if (document.querySelector('.watch-modal')) return;
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => {
    const c = card.current;
    if (!c || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(c, { y: 40, autoAlpha: 0, rotation: -1.5 }, { y: 0, autoAlpha: 1, rotation: 0, duration: 0.55, ease: 'expo.out' });
  }, [index]);

  return createPortal(
    // data-lenis-prevent: the tall dashboard scrolls inside its own frame
    <div className="inspector" role="dialog" aria-modal="true" aria-label={`Exhibit ${ex.letter}`} data-lenis-prevent onClick={onClose}>
      <div className="inspector__card" ref={card} onClick={(e) => e.stopPropagation()}>
        <div className="inspector__media">
          {ex.media.kind === 'image' ? (
            <img src={ex.media.src} alt={ex.alt} width={ex.media.w} height={ex.media.h} />
          ) : (
            // keyed: stepping from one film to the other must load the other clip
            <LoopVideo key={ex.id} className="inspector__video" src={ex.media.src} poster={ex.media.poster} />
          )}
        </div>
        <div className="inspector__cap">
          <span className="mono inspector__no">
            Exhibit {ex.letter} · {index + 1} of {EXHIBITS.length}
          </span>
          <p className="is-tagged" data-ents>
            {ex.caption}
          </p>
          {ex.watch && <WatchButton id={ex.watch.id} label={ex.watch.label} title={ex.watch.title} />}
        </div>
      </div>
      <div className="inspector__nav mono" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => go(-1)} data-cursor="hover">
          ← Prev
        </button>
        <button type="button" onClick={() => go(1)} data-cursor="hover">
          Next →
        </button>
        <button type="button" ref={closer} onClick={onClose} data-cursor="hover">
          Close ✕
        </button>
      </div>
    </div>,
    document.body,
  );
}
