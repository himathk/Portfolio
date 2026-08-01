import Clock from './Clock';

export default function Footer() {
  return (
    <footer className="foot mono">
      <span>© 2026 Himath Kariyawasam</span>
      <span>Built with Next.js, Three.js &amp; GSAP</span>
      <Clock prefix="Colombo " />
    </footer>
  );
}
