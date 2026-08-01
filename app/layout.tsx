import type { Metadata } from 'next';
import { Archivo, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import './globals.css';

/* Self-hosted through next/font rather than the Google CDN: removes a
   third-party request, the render-blocking stylesheet, and the FOUT. */
const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-display',
  display: 'swap',
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Himath Kariyawasam · Design, Motion & Code',
  description:
    'Himath Kariyawasam designs and builds bold, heavily animated interfaces.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${instrumentSerif.variable} ${jetbrains.variable}`}
    >
      {/* is-loading locks scroll until the preloader hands over */}
      <body className="is-loading">{children}</body>
    </html>
  );
}
