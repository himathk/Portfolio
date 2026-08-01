'use client';

import { useEffect, useState } from 'react';

/** Renders a static placeholder on the server and only starts ticking after
 *  mount, a live time rendered during SSR guarantees a hydration mismatch. */
export default function Clock({ prefix = '' }: { prefix?: string }) {
  const [time, setTime] = useState('--:--:--');

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-GB', { hour12: false }));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="clock">
      {prefix}
      {time}
    </span>
  );
}
