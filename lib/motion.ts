/* Shared animation clock.
 *
 * Everything that needs a per-frame update (WebGL, cursor, work preview, the
 * velocity-reactive marquee) subscribes here instead of opening its own rAF.
 * subscribe() returns an unsubscribe, and the loop plus its window listeners
 * shut down when the last subscriber leaves, which is what keeps React's
 * StrictMode double-mount from leaving a second loop running behind the first.
 */

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const smooth = (t: number) => t * t * (3 - 2 * t);

type Tick = (t: number) => void;

/** Pointer in normalised device coords (-1..1), eased. Raw pixels alongside. */
export const pointer = { x: 0, y: 0, tx: 0, ty: 0, px: 0, py: 0 };

/** Scroll progress through the document, 0 at the top, 1 at the bottom. */
export const view = { scrollP: 0 };

const subs = new Set<Tick>();
let rafId = 0;
let live = false;

function onPointerMove(e: PointerEvent) {
  pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  pointer.px = e.clientX;
  pointer.py = e.clientY;
}

function frame(now: number) {
  const t = now * 0.001;

  pointer.x = lerp(pointer.x, pointer.tx, 0.06);
  pointer.y = lerp(pointer.y, pointer.ty, 0.06);

  const max = document.documentElement.scrollHeight - window.innerHeight;
  view.scrollP = max > 0 ? clamp01(window.scrollY / max) : 0;

  for (const fn of subs) fn(t);

  rafId = requestAnimationFrame(frame);
}

export function subscribe(fn: Tick): () => void {
  subs.add(fn);

  if (!live) {
    live = true;
    pointer.px = window.innerWidth / 2;
    pointer.py = window.innerHeight / 2;
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    rafId = requestAnimationFrame(frame);
  }

  return () => {
    subs.delete(fn);
    if (subs.size === 0 && live) {
      live = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onPointerMove);
    }
  };
}
