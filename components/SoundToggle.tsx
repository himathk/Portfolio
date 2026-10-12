'use client';

import { useEffect, useState } from 'react';
import { isMuted, onMuteChange, play, setMuted, unlockAudio } from '@/lib/sfx';

/** The switch in the nav. It also wakes the audio on the visitor's first click
 *  or key press anywhere, since browsers won't play anything before one. */
export default function SoundToggle() {
  // starts "on" for the server render; the stored choice is read after mount
  const [muted, setState] = useState(false);

  useEffect(() => {
    setState(isMuted());
    const off = onMuteChange(setState);

    const unlock = () => {
      unlockAudio();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      off();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const toggle = () => {
    unlockAudio();
    const next = !muted;
    setMuted(next);
    if (!next) play('tick');
  };

  return (
    <button type="button" className="sound mono" aria-pressed={!muted} onClick={toggle} data-cursor="hover">
      <span className="sound__bars" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      Sound {muted ? 'off' : 'on'}
    </button>
  );
}
