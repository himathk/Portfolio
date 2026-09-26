'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Opens the full-length cut with sound. The site only self-hosts short silent
 * loops; the real thing plays from YouTube, which serves it in up to 4K for free.
 * The player is portalled to <body>: the case-study panels are clipped and pinned,
 * and either would trap or crop a fixed overlay rendered inside them.
 */
export default function WatchButton({ id, label, title }: { id: string; label: string; title: string }) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const closer = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closer.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      opener.current?.focus();
    };
  }, [open]);

  return (
    <>
      <button ref={opener} type="button" className="watch mono" data-cursor="hover" onClick={() => setOpen(true)}>
        <span className="watch__icon" aria-hidden="true" />
        {label}
      </button>
      {open &&
        createPortal(
          // data-lenis-prevent: wheel events over the player must not scroll the page behind it
          <div className="watch-modal" role="dialog" aria-modal="true" aria-label={title} data-lenis-prevent onClick={() => setOpen(false)}>
            <div className="watch-modal__frame" onClick={(e) => e.stopPropagation()}>
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`}
                title={title}
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
              />
            </div>
            <button ref={closer} type="button" className="watch-modal__close mono" onClick={() => setOpen(false)}>
              Close ✕
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
