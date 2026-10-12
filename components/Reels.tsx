'use client';

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { PROJECTS } from '@/lib/projects';
import { accent } from '@/lib/motion';
import { play, projectorRun } from '@/lib/sfx';
import Screen, { Viewer, type Phase } from '@/components/reels/Screen';
import { createReelScene, type ReelScene } from '@/components/reels/scene';

/* The projects as reels for a projector.
 *
 * Each project is a can in a stack on the table. Pick one, from the list or the
 * stack, and its reel is taken out, threaded on the projector and thrown on the
 * screen above, where its frames play through like slides. The list, the
 * screen and its controls are the real interface, all in the DOM; the canvas
 * behind them is the room they sit in. Without WebGL the screen still works on
 * its own.
 */

export default function Reels() {
  const stage = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const table = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const cursorHook = useRef<HTMLSpanElement>(null);
  const [sel, setSel] = useState(-1);
  const [phase, setPhase] = useState<Phase>('off');
  const [frame, setFrame] = useState(0);
  const [hover, setHover] = useState(-1);
  const [gl, setGl] = useState(true);
  const [full, setFull] = useState(false);

  // read from the scene's frame loop and from callbacks that outlive a render
  const selRef = useRef(-1);
  const hoverRef = useRef(-1);
  const scene = useRef<ReelScene | null>(null);
  const token = useRef(0);
  const calm = useRef(false);

  // whatever is hovered, or else what is loaded, lights its path in the graph
  useEffect(() => {
    const i = hover >= 0 ? hover : sel;
    accent.hex = i >= 0 ? PROJECTS[i].accent : null;
    accent.focus = i >= 0 ? PROJECTS[i].id : null;
  }, [hover, sel]);
  useEffect(
    () => () => {
      accent.hex = null;
      accent.focus = null;
      projectorRun(false);
    },
    [],
  );
  useEffect(() => {
    hoverRef.current = hover;
  }, [hover]);

  const eject = () => {
    token.current++;
    selRef.current = -1;
    setSel(-1);
    setPhase('off');
    setFull(false);
    projectorRun(false);
    scene.current?.eject();
    play('clack');
  };

  const pick = (i: number) => {
    if (selRef.current === i) return eject();
    const t = ++token.current;
    selRef.current = i;
    setSel(i);
    setFrame(0);
    setPhase('loading');
    setFull(false);
    play('clack');
    const lampOn = () => {
      // a reel picked since this one was asked for has taken over
      if (token.current !== t) return;
      setPhase(calm.current ? 'playing' : 'countdown');
      projectorRun(true);
    };
    if (scene.current) scene.current.load(i, lampOn);
    else window.setTimeout(lampOn, calm.current ? 0 : 450);
  };

  const go = (d: number) => {
    const p = PROJECTS[selRef.current];
    if (!p) return;
    setFrame((f) => (f + d + p.frames.length) % p.frames.length);
    play('clack');
  };

  // Escape takes the reel off (the full view catches it first while it is open)
  useEffect(() => {
    if (sel < 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') eject();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  // the arrow keys step through the frames while focus is anywhere in here
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (phase !== 'playing') return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(-1);
    }
  };

  useEffect(() => {
    calm.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canvas = canvasRef.current;
    const host = stage.current;
    const tbl = table.current;
    const scr = screenRef.current;
    if (!canvas || !host || !tbl || !scr) return;
    let dead = false;
    let made: ReelScene | null = null;
    // the cans' labels are drawn in the site's own type, so wait for it to load
    document.fonts.ready.then(() => {
      if (dead) return;
      made = createReelScene({
        canvas,
        stage: host,
        table: tbl,
        screen: scr,
        hook: cursorHook.current,
        calm: calm.current,
        listHover: () => hoverRef.current,
        onHover: setHover,
        onPick: (i) => pickRef.current(i),
        onEject: () => ejectRef.current(),
      });
      if (!made) {
        setGl(false);
        return;
      }
      scene.current = made;
      // a reel picked before the room was ready goes straight on
      if (selRef.current >= 0) made.load(selRef.current, () => {});
    });
    return () => {
      dead = true;
      made?.dispose();
      scene.current = null;
    };
  }, []);

  // the scene's handlers are bound once; route them through the latest closures
  const pickRef = useRef(pick);
  pickRef.current = pick;
  const ejectRef = useRef(eject);
  ejectRef.current = eject;

  const p = sel >= 0 ? PROJECTS[sel] : null;

  return (
    <div className={`reels${gl ? '' : ' reels--flat'}${sel >= 0 ? ' has-pick' : ''}`} onKeyDown={onKeyDown}>
      <div className="reels__side">
        <ol className="reels__index">
          {PROJECTS.map((x, i) => (
            <li key={x.id}>
              <button
                type="button"
                className={`reels__item${hover === i ? ' is-hover' : ''}`}
                aria-pressed={sel === i}
                aria-controls="reel-detail"
                data-cursor="view"
                onClick={() => pick(i)}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(-1)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(-1)}
              >
                <span className="mono reels__n">{x.n}</span>
                <span className="reels__name">{x.title}</span>
                <span className="mono reels__yr">{x.yr}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="reels__detail" id="reel-detail" aria-live="polite">
          {p ? (
            <>
              <p className="mono reels__cat">
                Reel {p.n} · {p.cat}
              </p>
              {p.blurb && <p className="reels__blurb">{p.blurb}</p>}
              <div className="reels__actions">
                {p.link && (
                  <a className="reels__cta mono" href={p.link.href} data-cursor="hover">
                    {p.link.label}
                  </a>
                )}
                <button type="button" className="reels__back mono" data-cursor="hover" onClick={eject}>
                  Take it off
                </button>
              </div>
            </>
          ) : (
            <p className="mono reels__hint">Pick a reel and it goes on the projector.</p>
          )}
        </div>
      </div>

      <div className="reels__stage" ref={stage}>
        <canvas ref={canvasRef} aria-hidden="true" />
        <Screen
          screenRef={screenRef}
          p={p}
          phase={phase}
          frame={frame}
          onGo={go}
          onReady={() => setPhase('playing')}
          onFull={() => setFull(true)}
        />
        <div className="reels__table" ref={table} aria-hidden="true" />
        <span className="reels__cursor" ref={cursorHook} data-cursor="load" hidden />
      </div>

      {full && p && phase === 'playing' && <Viewer p={p} frame={frame} onGo={go} onClose={() => setFull(false)} />}
    </div>
  );
}
