const CARDS = [
  { n: '01 / Product', title: 'Aegis', art: 'g1' },
  { n: '02 / Product', title: 'JewishChat', art: 'g2' },
  { n: '03 / Product', title: 'InfoIns', art: 'g3' },
  { n: '04 / Print', title: 'Posters', art: 'g4' },
  { n: '05 / Identity', title: 'Brands', art: 'g5' },
  { n: '06 / Direction', title: 'Mood Boards', art: 'g6' },
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
            <p className="mono">
              Product work, posters, brand sheets and mood boards. Scroll to travel →
            </p>
          </div>

          {CARDS.map((c) => (
            <figure className={`card ${c.art}`} key={c.title}>
              <span className="mono">{c.n}</span>
              <h4>{c.title}</h4>
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
