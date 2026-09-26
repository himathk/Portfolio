type Card = {
  n: string;
  title: string;
  credit: string;
  img: string;
  alt: string;
  /** in-page case study the card opens */
  href?: string;
};

const CARDS: Card[] = [
  {
    n: '01 / Product',
    title: 'Aegis',
    credit: 'Identity & promo',
    img: '/work/aegis/card.webp',
    alt: 'The Aegis shield logo, from the promo I animated',
    href: '#aegis',
  },
  {
    n: '02 / Fan art poster',
    title: 'Yogeshwari',
    credit: 'For Charitha Attalage',
    img: '/designs/yogeshwari.webp',
    alt: 'Yogeshwari, a fan-art concert poster for Charitha Attalage: two halftone hands reaching for an eye across acid-green type',
  },
  {
    n: '03 / Fan art poster',
    title: 'Kuweniverse',
    credit: 'For Charitha Attalage',
    img: '/designs/kuweniverse.webp',
    alt: 'Kuweniverse, a fan-art concert poster for Charitha Attalage: an astronaut facing a black hole behind orange type',
  },
  {
    n: '04 / Fan art poster',
    title: 'Alokawarsha',
    credit: 'For Dhanith Sri',
    img: '/designs/alokawarsha.webp',
    alt: 'Alokawarsha, a fan-art concert poster for Dhanith Sri: watercolour whales swimming through a starry sky',
  },
];

export default function Gallery() {
  return (
    <section className="gallery" id="designs">
      <div className="gallery__pin">
        <div className="gallery__track" id="galleryTrack">
          <div className="gallery__intro">
            <span className="rail mono">(DESIGNS)</span>
            <h2 className="gallery__title">
              Visual
              <br />
              <em className="serif">work</em>
            </h2>
            <p className="mono">Product work and poster art. Keep scrolling →</p>
          </div>

          {CARDS.map((c) => (
            <figure className="card" key={c.title}>
              <div className="card__art">
                <img src={c.img} alt={c.alt} width={1000} height={1414} loading="lazy" />
              </div>
              <figcaption className="card__cap">
                <span className="mono">{c.n}</span>
                <h4>{c.title}</h4>
                <span className="mono card__credit">{c.credit}</span>
              </figcaption>
              {/* laid over the whole card: a figcaption can't sit inside a link */}
              {c.href && (
                <a className="card__link" href={c.href} data-cursor="view" aria-label={`Open the ${c.title} case study`} />
              )}
            </figure>
          ))}

          <div className="gallery__end">
            <h3 className="serif">
              and
              <br />
              more.
            </h3>
          </div>
        </div>
      </div>
    </section>
  );
}
