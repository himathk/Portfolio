/* The five projects, in one place: the film-can reels, their detail panel, the
 * skills graph's hover paths (lib/graph PROJECTS, keyed by `id`) and the
 * evidence board all read from here.
 */

/** One frame of the film strip that unspools from a reel: a still from the
 *  work, or a title card set in type for projects with no imagery yet. */
export type Frame =
  | { kind: 'image'; src: string }
  | { kind: 'title'; text: string; style: 'display' | 'serif' | 'mono' };

export type Project = {
  /** key into lib/graph PROJECTS: the path this project lights in the graph */
  id: string;
  n: string;
  title: string;
  cat: string;
  yr: string;
  /** hover colour, and the stripe on the reel's tape */
  accent: string;
  /** two glows behind the title cards, the same art the old list used */
  glow: [string, string];
  /** what the can is pressed from */
  metal: 'steel' | 'gunmetal' | 'brass' | 'copper';
  blurb?: string;
  link?: { href: string; label: string };
  frames: [Frame, Frame, Frame];
};

export const PROJECTS: Project[] = [
  {
    id: 'aegis',
    n: '01',
    title: 'Aegis',
    cat: 'Investigative AI · Lead, ML & UI/UX',
    yr: '2025-26',
    accent: '#5B8CFF',
    glow: ['#5B8CFF', '#0a0f2e'],
    metal: 'gunmetal',
    blurb: 'Automated evidence and graph intelligence for Sri Lankan law enforcement.',
    link: { href: '#aegis', label: 'Open the case ↓' },
    frames: [
      { kind: 'image', src: '/work/aegis/trailer-poster.webp' },
      { kind: 'image', src: '/work/aegis/promo-poster.webp' },
      { kind: 'image', src: '/work/aegis/screen-case.webp' },
    ],
  },
  {
    id: 'snapvibe',
    n: '02',
    title: 'SnapVibe',
    cat: 'Event Photo Booth · Solo Design & Build',
    yr: '2026',
    accent: '#D4AF37',
    glow: ['#D4AF37', '#1a1408'],
    metal: 'brass',
    blurb: 'Magazine-cover photo booths for weddings, hotels and corporate events in Sri Lanka.',
    link: { href: '#snapvibe', label: 'Try it live ↓' },
    frames: [
      { kind: 'image', src: '/work/snapvibe/site.webp' },
      { kind: 'image', src: '/work/snapvibe/studio.webp' },
      { kind: 'image', src: '/work/snapvibe/preview.webp' },
    ],
  },
  {
    id: 'infoins',
    n: '03',
    title: 'InfoIns',
    cat: 'Insurance Platform · Design & Frontend',
    yr: 'Since 2023',
    accent: '#3EFFC8',
    glow: ['#D8FF3E', '#0F6B4A'],
    metal: 'steel',
    frames: [
      { kind: 'title', text: 'InfoIns', style: 'display' },
      { kind: 'title', text: 'Design & Frontend', style: 'serif' },
      { kind: 'title', text: 'Since 2023', style: 'mono' },
    ],
  },
  {
    id: 'jewishchat',
    n: '04',
    title: 'JewishChat',
    cat: 'Community Groups · Lead Designer',
    yr: '2026',
    accent: '#4CC9FF',
    glow: ['#1CC7FF', '#B01CFF'],
    metal: 'steel',
    frames: [
      { kind: 'title', text: 'JewishChat', style: 'display' },
      { kind: 'title', text: 'Lead Designer', style: 'serif' },
      { kind: 'title', text: '2026', style: 'mono' },
    ],
  },
  {
    id: 'heliez',
    n: '05',
    title: 'Heliez LK',
    cat: 'Cake Artistry · Design & Dev Lead',
    yr: '2026',
    accent: '#FFB03E',
    glow: ['#FFB03E', '#FF2D78'],
    metal: 'copper',
    frames: [
      { kind: 'title', text: 'Heliez LK', style: 'display' },
      { kind: 'title', text: 'Design & Dev Lead', style: 'serif' },
      { kind: 'title', text: '2026', style: 'mono' },
    ],
  },
];
