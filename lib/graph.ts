/* The skills graph: what stands in the hero where the blob used to.
 *
 * The dots are the toolkit, five disciplines as hubs with their tools around
 * them. A line from a tool to its hub says where it belongs; a line between
 * hubs is a project, drawn as the path through the disciplines it used. The
 * Toolkit section renders the same data as a plain list, so this file is the
 * one place to edit either.
 */

export type Tool = { name: string; key?: boolean };
export type Hub = { id: string; label: string; tools: Tool[] };

/** In the order the Toolkit lists them. `key` tools draw a little larger. */
export const HUBS: Hub[] = [
  {
    id: 'languages',
    label: 'Languages',
    tools: [{ name: 'HTML' }, { name: 'CSS' }, { name: 'JavaScript', key: true }, { name: 'Java' }],
  },
  {
    id: 'frameworks',
    label: 'Frameworks',
    tools: [
      { name: 'React' },
      { name: 'Next.js' },
      { name: 'Three.js' },
      { name: 'Spring Boot' },
      { name: 'GSAP' },
      { name: 'Tailwind' },
    ],
  },
  {
    id: 'design',
    label: 'Design',
    tools: [{ name: 'Figma', key: true }, { name: 'Photoshop' }],
  },
  {
    id: 'film',
    label: 'Film, Motion & 3D',
    tools: [{ name: 'After Effects', key: true }, { name: 'Premiere Pro' }, { name: 'Blender' }, { name: 'Lottie' }],
  },
  {
    id: 'data',
    label: 'Data & ML',
    tools: [{ name: 'Python' }, { name: 'Neo4j' }],
  },
];

/** Around the ring, design sits between front-end and film, the two things it
 *  most often meets in the projects below, which keeps their lines short. */
const RING = ['design', 'frameworks', 'languages', 'data', 'film'];

export const toolId = (name: string) => 'tool:' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/** Each project's path through the graph, walked in order. Only what the
 *  case study or the work list says: a project lights the disciplines in its
 *  role line, and a tool only where the copy names it. Keys match Work.tsx. */
export const PROJECTS: Record<string, string[]> = {
  // designed every screen, built the entity extraction, animated the promo in
  // After Effects, directed and shot the trailer
  aegis: ['design', 'data', 'film', toolId('After Effects')],
  // solo design and build
  snapvibe: ['design', 'languages', 'frameworks'],
  // design & frontend
  infoins: ['design', 'languages', 'frameworks'],
  // lead designer
  jewishchat: ['design'],
  // design & dev lead
  heliez: ['design', 'languages', 'frameworks'],
};

export type GraphNode = {
  id: string;
  label: string;
  hub: boolean;
  /** index into HUBS of the hub it belongs to (itself, for a hub) */
  group: number;
  key: boolean;
};

export type GraphEdge = {
  a: number;
  b: number;
  /** a project path rather than a tool's line to its hub */
  project: boolean;
  /** projects that walk this edge, for lighting it on hover */
  projects: string[];
};

export const NODES: GraphNode[] = [];
HUBS.forEach((h, g) => {
  NODES.push({ id: h.id, label: h.label, hub: true, group: g, key: true });
  h.tools.forEach((t) => NODES.push({ id: toolId(t.name), label: t.name, hub: false, group: g, key: !!t.key }));
});

const indexOf = new Map(NODES.map((n, i) => [n.id, i]));

export const EDGES: GraphEdge[] = [];
const edgeAt = new Map<string, GraphEdge>();
const pair = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

NODES.forEach((n, i) => {
  if (n.hub) return;
  const e: GraphEdge = { a: indexOf.get(HUBS[n.group].id)!, b: i, project: false, projects: [] };
  EDGES.push(e);
  edgeAt.set(pair(e.a, e.b), e);
});

Object.entries(PROJECTS).forEach(([project, path]) => {
  for (let k = 1; k < path.length; k++) {
    const a = indexOf.get(path[k - 1]);
    const b = indexOf.get(path[k]);
    if (a === undefined || b === undefined) continue;
    let e = edgeAt.get(pair(a, b));
    if (!e) {
      e = { a, b, project: true, projects: [] };
      EDGES.push(e);
      edgeAt.set(pair(a, b), e);
    }
    e.projects.push(project);
  }
});

/** Node indices lit by a hover: a project's path, or a hub and its tools. */
export function focusNodes(key: string): Set<number> {
  const path = PROJECTS[key];
  if (path) return new Set(path.map((id) => indexOf.get(id)).filter((i): i is number => i !== undefined));
  const g = HUBS.findIndex((h) => h.id === key);
  if (g < 0) return new Set();
  return new Set(NODES.flatMap((n, i) => (n.group === g ? [i] : [])));
}

/** Whether an edge belongs to the hovered project or hub. */
export function edgeInFocus(e: GraphEdge, key: string): boolean {
  if (PROJECTS[key]) return e.projects.includes(key);
  const g = HUBS.findIndex((h) => h.id === key);
  return g >= 0 && !e.project && NODES[e.b].group === g;
}

/* ---------- layout ---------- */

/** Small seeded PRNG, so the scatter is the same on every visit. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Layout = {
  /** the loose cloud the hero shows, nothing yet connected */
  scatter: Float32Array;
  /** the finished graph: hubs on a ring, tools fanned outward from them */
  graph: Float32Array;
  /** per node: how late it settles into the graph, 0..1 */
  lag: Float32Array;
  /** per edge: when in the connect progress it starts drawing, 0..1 */
  delay: Float32Array;
  /** per node: drift phase */
  phase: Float32Array;
};

export function layoutGraph(): Layout {
  const rnd = mulberry32(1708);
  const n = NODES.length;
  const scatter = new Float32Array(n * 3);
  const graph = new Float32Array(n * 3);
  const lag = new Float32Array(n);
  const phase = new Float32Array(n);

  const hubAngle = (g: number) => -Math.PI / 2 + (RING.indexOf(HUBS[g].id) / RING.length) * Math.PI * 2;
  const counts = HUBS.map((h) => h.tools.length);
  const seen = HUBS.map(() => 0);

  NODES.forEach((node, i) => {
    // scatter: a point inside a squashed sphere, a little wider than tall to
    // match the frame it sits in
    let x = 0;
    let y = 0;
    let z = 0;
    do {
      x = rnd() * 2 - 1;
      y = rnd() * 2 - 1;
      z = rnd() * 2 - 1;
    } while (x * x + y * y + z * z > 1);
    const r = node.hub ? 0.8 : 1.05;
    scatter.set([x * r * 1.1, y * r * 0.9, z * r], i * 3);

    const a = hubAngle(node.group);
    if (node.hub) {
      // the ring, tipped slightly so it never reads as a flat diagram
      graph.set([Math.cos(a) * 1.0, Math.sin(a) * 0.86, Math.sin(a * 2 + 0.6) * 0.18], i * 3);
      lag[i] = rnd() * 0.08;
    } else {
      // tools fan out away from the centre, spread evenly across +/-70 degrees
      const k = seen[node.group]++;
      const m = counts[node.group];
      const spread = m > 1 ? (k / (m - 1) - 0.5) * ((Math.PI * 140) / 180) : 0;
      const ta = a + spread + (rnd() - 0.5) * 0.12;
      const tr = 0.4 + rnd() * 0.1 + (m > 4 ? 0.06 : 0);
      graph.set(
        [Math.cos(a) * 1.0 + Math.cos(ta) * tr, Math.sin(a) * 0.86 + Math.sin(ta) * tr, (rnd() - 0.5) * 0.3],
        i * 3,
      );
      lag[i] = 0.1 + rnd() * 0.2;
    }
    phase[i] = rnd() * Math.PI * 2;
  });

  // tool lines draw first, a hub at a time; project lines once the clusters exist
  const delay = new Float32Array(EDGES.length);
  EDGES.forEach((e, k) => {
    delay[k] = e.project ? 0.5 + rnd() * 0.12 : 0.12 + RING.indexOf(HUBS[NODES[e.b].group].id) * 0.05 + rnd() * 0.08;
  });

  return { scatter, graph, lag, delay, phase };
}
