const DISCIPLINES = [
  ['01 / Discipline', 'Product &', 'Interface Design'],
  ['02 / Discipline', 'Brand &', 'Art Direction'],
  ['03 / Discipline', 'Motion &', 'Interaction'],
  ['04 / Discipline', 'Front-End', 'Development'],
];

export default function Manifesto() {
  return (
    <section className="manifesto" id="about">
      <span className="rail mono">(ABOUT)</span>

      <p className="manifesto__text" data-split="words">
        I design things and then I build them. Both halves, same project, most of the time. It means
        less gets lost on the way from the file to the browser. Mostly product interfaces, with brand
        and motion work around the edges. I would rather over-animate than ship something{' '}
        <em className="serif">flat.</em>
      </p>

      <div className="manifesto__grid">
        {DISCIPLINES.map(([label, a, b]) => (
          <div className="mcard" key={label}>
            <span className="mono">{label}</span>
            <h3>
              {a}
              <br />
              {b}
            </h3>
          </div>
        ))}
      </div>
    </section>
  );
}
