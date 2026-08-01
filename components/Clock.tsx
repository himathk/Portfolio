'use client';

import { useEffect, useState } from 'react';

/** Renders a static placeholder on the server and only starts ticking after
 *  mount: a live time rendered during SSR guarantees a hydration mismatch.
 *
 *  Pinned to a timezone rather than the viewer's. Left on the browser default
 *  this just mirrors the reader's own clock back at them, which tells them
 *  nothing. The point of the pattern is to show where I am.
 */
export default function Clock({
  prefix = '',
  timeZone = 'Asia/Colombo',
}: {
  prefix?: string;
  timeZone?: string;
}) {
  const [time, setTime] = useState('--:--:--');

  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString('en-GB', { hour12: false, timeZone }));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timeZone]);

  return (
    <span className="clock">
      {prefix}
      {time}
    </span>
  );
}
