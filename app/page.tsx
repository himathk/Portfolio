import Preloader from '@/components/Preloader';
import WebGLCanvas from '@/components/WebGLCanvas';
import Cursor from '@/components/Cursor';
import SmoothScroll from '@/components/SmoothScroll';
import ScrollAnimations from '@/components/ScrollAnimations';
import Nav from '@/components/Nav';
import Hero from '@/components/Hero';
import Manifesto from '@/components/Manifesto';
import Toolkit from '@/components/Toolkit';
import Strip from '@/components/Strip';
import Work from '@/components/Work';
import Gallery from '@/components/Gallery';
import Education from '@/components/Education';
import Contact from '@/components/Contact';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <>
      <Preloader />

      {/* fixed WebGL layer, spans the whole page */}
      <WebGLCanvas />
      <div className="vignette" />
      <div className="grain" />

      <Cursor />
      <SmoothScroll />
      <ScrollAnimations />

      <Nav />

      <main id="top">
        <Hero />
        <Manifesto />
        <Toolkit />
        <Strip />
        <Work />
        <Gallery />
        <Education />
        <Contact />
      </main>

      <Footer />
    </>
  );
}
