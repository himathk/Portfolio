'use client';

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type Ref } from 'react';
import { createPortal } from 'react-dom';
import LoopVideo from '@/components/LoopVideo';
import type { Frame, Project } from '@/lib/projects';
import { play } from '@/lib/sfx';

/* The screen the projector throws its light on. It is plain DOM over the
 * projector's canvas: the frames are real images and video at full
 * resolution, readable and selectable, and the beam is drawn to its edges.
 *
 *   off        nothing loaded: a dim leader and a prompt
 *   loading    a reel is on its way to the projector
 *   countdown  the lamp is up: 3, 2, 1 on an old leader (click to skip)
 *   playing    the frames, one at a time, like slides
 */

export type Phase = 'off' | 'loading' | 'countdown' | 'playing';

const pad = (n: number) => String(n).padStart(2, '0');

export const captionOf = (f: Frame, p: Project) => (f.kind === 'title' ? p.cat : f.caption);

/** One frame, as thrown on the screen. */
function FrameView({ f, p }: { f: Frame; p: Project }) {
  if (f.kind === 'image') return <img className="shot" src={f.src} alt={f.alt} width={f.w} height={f.h} draggable={false} />;
  if (f.kind === 'video') return <LoopVideo className="shot" src={f.src} poster={f.poster} />;
  return (
    <div className={`tcard tcard--${f.style}`} style={{ '--g1': p.glow[0], '--g2': p.glow[1] } as CSSProperties}>
      <span>{f.text}</span>
    </div>
  );
}

/** The countdown on an old film leader: a sweep round the circle per number. */
function Leader({ onEnd }: { onEnd: () => void }) {
  const [n, setN] = useState(3);
  const end = useRef(onEnd);
  end.current = onEnd;
  useEffect(() => {
    if (n === 0) {
      end.current();
      return;
    }
    play('tick');
    const t = window.setTimeout(() => setN((x) => x - 1), 480);
    return () => window.clearTimeout(t);
  }, [n]);
  return (
    <div className="leader" aria-hidden="true">
      <i className="leader__sweep" key={n} />
      <i className="leader__ring" />
      <b className="leader__n">{n > 0 ? n : ''}</b>
    </div>
  );
}

type ScreenProps = {
  /** the picture itself, where the projector aims */
  screenRef: Ref<HTMLDivElement>;
  p: Project | null;
  phase: Phase;
  frame: number;
  onGo: (d: number) => void;
  onReady: () => void;
  onFull: () => void;
};

export default function Screen({ screenRef, p, phase, frame, onGo, onReady, onFull }: ScreenProps) {
  const n = p ? p.frames.length : 0;
  const f = p && phase === 'playing' ? p.frames[frame] : null;

  // a click or tap moves on a frame; a swipe goes either way
  const down = useRef<{ x: number; y: number } | null>(null);
  const onDown = (e: ReactPointerEvent) => {
    down.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: ReactPointerEvent) => {
    const d = down.current;
    down.current = null;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (phase === 'countdown') onReady();
    else if (phase !== 'playing') return;
    else if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) onGo(dx < 0 ? 1 : -1);
    else if (Math.hypot(dx, dy) < 8) onGo(1);
  };

  return (
    <div className={`screen screen--${phase}`}>
      <div
        ref={screenRef}
        className="screen__inner"
        data-cursor={phase === 'playing' ? 'next' : 'hover'}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={() => (down.current = null)}
      >
        {phase === 'off' && (
          <div className="screen__idle" aria-hidden="true">
            <i className="leader__ring" />
            <span className="mono">Pick a reel</span>
          </div>
        )}
        {phase === 'loading' && p && (
          <p className="mono screen__note" aria-hidden="true">
            Threading reel {p.n}
          </p>
        )}
        {phase === 'countdown' && <Leader onEnd={onReady} />}
        {f && p && (
          <div className="screen__frame" key={`${p.id}-${frame}`}>
            <FrameView f={f} p={p} />
          </div>
        )}
        <i className="screen__fx" aria-hidden="true" />
      </div>

      <div className="screen__bar">
        <span className="mono screen__count">{f ? `${pad(frame + 1)} / ${pad(n)}` : p ? `Reel ${p.n}` : 'Projector idle'}</span>
        <p className="screen__cap" aria-live="polite">
          {f && p ? captionOf(f, p) : ''}
        </p>
        <div className="screen__nav mono">
          <button type="button" onClick={() => onGo(-1)} disabled={!f} aria-label="Previous frame" data-cursor="hover">
            ←
          </button>
          <button type="button" onClick={() => onGo(1)} disabled={!f} aria-label="Next frame" data-cursor="hover">
            →
          </button>
          <button type="button" onClick={onFull} disabled={!f} data-cursor="hover">
            Full view
          </button>
        </div>
      </div>
    </div>
  );
}

/** A frame as big as the window allows, with the rest of the reel a key away. */
export function Viewer({ p, frame, onGo, onClose }: { p: Project; frame: number; onGo: (d: number) => void; onClose: () => void }) {
  const f = p.frames[frame];
  const closer = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    closer.current?.focus();
    // capture, so Escape closes this and not the projector behind it
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      close.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      back?.focus?.();
    };
  }, []);

  return createPortal(
    // arrow keys reach the reels' own handler through the React tree
    <div
      className="viewer"
      role="dialog"
      aria-modal="true"
      aria-label={`${p.title}, frame ${frame + 1} of ${p.frames.length}`}
      data-lenis-prevent
      onClick={onClose}
    >
      <div className="viewer__box" onClick={(e) => e.stopPropagation()}>
        <div className="screen__frame" key={frame}>
          <FrameView f={f} p={p} />
        </div>
      </div>
      <div className="viewer__bar" onClick={(e) => e.stopPropagation()}>
        <span className="mono screen__count">
          {pad(frame + 1)} / {pad(p.frames.length)}
        </span>
        <p className="screen__cap">{captionOf(f, p)}</p>
        <div className="screen__nav mono">
          <button type="button" onClick={() => onGo(-1)} aria-label="Previous frame">
            ←
          </button>
          <button type="button" onClick={() => onGo(1)} aria-label="Next frame">
            →
          </button>
          <button type="button" ref={closer} onClick={onClose}>
            Close ✕
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
