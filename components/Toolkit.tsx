/** `key: true` renders in the accent colour at a larger size. */
const ROWS: { label: string; items: { name: string; key?: boolean }[] }[] = [
  {
    label: 'Languages',
    items: [{ name: 'HTML' }, { name: 'CSS' }, { name: 'JavaScript', key: true }, { name: 'Java' }],
  },
  {
    label: 'Frameworks',
    items: [
      { name: 'React' },
      { name: 'Next.js' },
      { name: 'Three.js' },
      { name: 'Spring Boot' },
      { name: 'GSAP' },
      { name: 'Tailwind' },
    ],
  },
  {
    label: 'Design',
    items: [{ name: 'Figma', key: true }, { name: 'Photoshop' }],
  },
  {
    label: 'Motion & 3D',
    items: [
      { name: 'After Effects', key: true },
      { name: 'Premiere Pro' },
      { name: 'Blender' },
      { name: 'Lottie' },
    ],
  },
  {
    label: 'Data & ML',
    items: [{ name: 'Python' }, { name: 'Neo4j' }],
  },
];

export default function Toolkit() {
  return (
    <section className="toolkit" id="toolkit">
      <div className="sec-head">
        <span className="rail mono">(TOOLKIT)</span>
        <h2 className="sec-title" data-split="chars">
          Toolkit
        </h2>
        <span className="mono sec-count">What I work in</span>
      </div>

      <ul className="toolset">
        {ROWS.map((row) => (
          <li className="toolrow" key={row.label}>
            <span className="toolrow__label mono">{row.label}</span>
            <p className="toolrow__items">
              {row.items.map((it) => (
                <span className={it.key ? 'tool tool--key' : 'tool'} key={it.name}>
                  {it.name}
                </span>
              ))}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
