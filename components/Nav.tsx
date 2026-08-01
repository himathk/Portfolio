import Clock from './Clock';

const LINKS = [
  { href: '#toolkit', label: 'Toolkit' },
  { href: '#work', label: 'Work' },
  { href: '#designs', label: 'Designs' },
  { href: '#education', label: 'Education' },
  { href: '#contact', label: 'Contact' },
];

export default function Nav() {
  return (
    <header className="nav">
      <a href="#top" className="nav__mark" data-cursor="hover">
        <span className="nav__mark-glyph">HK</span>
        <span className="mono nav__mark-txt">HIMATH KARIYAWASAM</span>
      </a>

      <nav className="nav__links mono">
        {LINKS.map((l) => (
          <a key={l.href} href={l.href} data-cursor="hover">
            {l.label}
          </a>
        ))}
      </nav>

      <div className="nav__meta mono">
        <span className="status">
          <i /> Open for work
        </span>
        <Clock />
      </div>
    </header>
  );
}
