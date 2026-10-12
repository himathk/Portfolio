'use client';

import { HUBS } from '@/lib/graph';
import { accent } from '@/lib/motion';

/* The graph itself is the toolkit now: while this section is on screen the
 * WebGL scene brings it front and centre with every dot named. This list is the
 * same data as text, the index beside it (hover a discipline and its cluster
 * lights up), and the whole thing on phones, without WebGL, or for a screen
 * reader, where the drawn labels aren't available. */
export default function Toolkit() {
  const total = HUBS.reduce((n, h) => n + h.tools.length, 0);

  return (
    <section className="toolkit" id="toolkit">
      <div className="sec-head">
        <span className="rail mono">(TOOLKIT)</span>
        <h2 className="sec-title" data-split="chars">
          Toolkit
        </h2>
        <span className="mono sec-count">
          {HUBS.length} disciplines, {total} tools
        </span>
      </div>

      <div className="toolkit__stage">
        <ul className="toolkit__legend">
          {HUBS.map((h) => (
            <li
              className="toolkit__group"
              key={h.id}
              onPointerEnter={() => {
                accent.focus = h.id;
              }}
              onPointerLeave={() => {
                accent.focus = null;
              }}
            >
              <span className="toolkit__name">{h.label}</span>
              <span className="mono toolkit__count" aria-hidden="true">
                {String(h.tools.length).padStart(2, '0')}
              </span>
              <span className="toolkit__tools">{h.tools.map((t) => t.name).join(', ')}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
