import Clock from './Clock';

/* The page ends the way a film does. Every line is a plain fact about the
   site itself; the roll is scrubbed by the last stretch of scroll
   (ScrollAnimations), and simply sits still with reduced motion. */
const CREDITS: [string, string][] = [
  ['Design, motion & code', 'Himath Kariyawasam'],
  ['Type', 'Archivo · Instrument Serif · JetBrains Mono'],
  ['Built with', 'Next.js · Three.js · GSAP · Lenis'],
];

export default function Footer() {
  return (
    <footer className="credits">
      <div className="credits__roll">
        <p className="mono credits__label">(Credits)</p>
        <dl className="credits__list">
          {CREDITS.map(([role, name]) => (
            <div className="credits__row" key={role}>
              <dt className="mono">{role}</dt>
              <dd>{name}</dd>
            </div>
          ))}
          <div className="credits__row">
            <dt className="mono">Local time</dt>
            <dd>
              <Clock prefix="Colombo " />
            </dd>
          </div>
        </dl>
        <p className="mono credits__fin">© 2026 Himath Kariyawasam</p>
      </div>
    </footer>
  );
}
