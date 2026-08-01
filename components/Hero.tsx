const TICKER = 'DESIGN ✦ MOTION ✦ CODE ✦ UI/UX ✦ FRONT-END ✦ BRAND ✦';

export default function Hero() {
  return (
    <section className="hero">
      {/* header rule sits under the nav; margin-bottom:auto pins it up there
          while the rest of the hero stays bottom-aligned */}
      <div className="hero__eyebrow mono" data-anim="fade">
        <span>Portfolio</span>
        <span>Vol. 01 — MMXXVI</span>
      </div>

      <div className="hero__type">
        {/* the serif accent rides the SHORT line: KARIYAWASAM needs the full measure */}
        <h1 className="hero__title">
          <span className="line line--indent">
            <span className="line__i">
              HIM<span className="dot">A</span>TH
            </span>
            <em className="serif" data-anim="fade">
              Design, motion
              <br />
              &amp; code
            </em>
          </span>
          <span className="line">
            <span className="line__i">KARIYAWASAM</span>
          </span>
        </h1>

        <div className="hero__foot">
          <p className="hero__blurb" data-anim="fade">
            I build bold designs with heavy animation that grabs attention and keeps it. I built{' '}
            <em className="serif">the</em> investigation system in Sri Lanka.
          </p>
          <a href="#work" className="scrollcue mono" data-cursor="hover">
            <span>Scroll</span>
            <svg viewBox="0 0 16 40" aria-hidden="true">
              <path d="M8 0v34M2 28l6 8 6-8" />
            </svg>
          </a>
        </div>
      </div>

      <div className="ticker">
        <div className="ticker__track">
          <span>{TICKER}</span>
          <span>{TICKER}</span>
          <span>{TICKER}</span>
        </div>
      </div>
    </section>
  );
}
