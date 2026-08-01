/* No dates supplied, so the eyebrow carries the qualification level instead.
   Swap `level` for year ranges when they're available. */
const STUDIES = [
  { level: 'Postgraduate', title: 'Software Engineering', where: 'IIT.' },
  {
    level: 'Diploma',
    title: 'Information & Communication Technology',
    where: 'NIBM.',
  },
  { level: 'Advanced Level', title: 'Mathematics Stream', where: "St. Joseph's College, Colombo 10." },
];

export default function Education() {
  return (
    <section className="edu" id="education">
      <div className="sec-head">
        <span className="rail mono">(EDUCATION)</span>
        <h2 className="sec-title" data-split="chars">
          Studies
        </h2>
        <span className="mono sec-count">Where I studied</span>
      </div>

      <div className="timeline">
        <i className="timeline__line" id="tlLine" />

        {STUDIES.map((s) => (
          <article className="tl-item" key={s.title}>
            <span className="mono tl-item__yr">{s.level}</span>
            <h3>{s.title}</h3>
            <p className="mono">{s.where}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
