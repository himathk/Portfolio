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
        I work on enterprise interfaces, the kind with twelve fields on screen and a user
        who&apos;s been staring at them since <em className="serif">8am.</em> Design and build, both
        halves, so the thing in the browser is the thing in the file. Brand and motion work around
        the edges.
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
