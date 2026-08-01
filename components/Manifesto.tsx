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
        Design, motion and code — usually all three on the same project. I move between leading the
        design and shipping the front end, across investigative AI, enterprise insurance and
        community platforms. Everything built bold, animated <em className="serif">heavily,</em> and
        made to hold attention.
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
