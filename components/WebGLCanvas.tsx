'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { NODE_VERT, NODE_FRAG, PORTRAIT_VERT, PORTRAIT_FRAG } from '@/lib/shaders';
import { subscribe, pointer, view, accent, lerp, clamp01, smooth } from '@/lib/motion';
import { NODES, EDGES, layoutGraph, focusNodes, edgeInFocus } from '@/lib/graph';

gsap.registerPlugin(ScrollTrigger);

/* The graph's path down the page. Each key hangs off a section (`at`, its top, or
   its bottom with `.end`), shifted by `off` viewport heights, so the choreography
   follows the sections wherever they land instead of a fixed share of the page,
   which went stale every time a section grew. x/y are NORMALISED to the visible
   frustum at the graph's depth: 1 = the screen edge, 0 = dead centre. World units
   would look right on one aspect ratio only, on a portrait phone the visible
   half-width collapses to ~0.9 world units, which would throw the graph clean
   off-screen for most of the page. */
type Key = { at: string; off: number; x: number; y: number; z: number; s: number; c: string };
const KEYS: Key[] = [
  // hero: a loose cloud on the right, the thing the portrait is looking at
  { at: 'top', off: 0, x: 0.54, y: 0.24, z: 0.0, s: 1.04, c: '#D8FF3E' },
  // about: left of the manifesto, where its lines draw in
  { at: 'about', off: 0.2, x: -0.46, y: 0.04, z: -0.8, s: 0.82, c: '#FF4D1C' },
  // toolkit: front and centre, turned to face you, labelled
  { at: 'toolkit', off: 0.45, x: 0.2, y: -0.06, z: 0.2, s: 1.0, c: '#D8FF3E' },
  { at: 'toolkit.end', off: -1.0, x: 0.2, y: -0.06, z: 0.2, s: 1.0, c: '#D8FF3E' },
  // work: the lights go down for the projector, so it slips off the right edge,
  // and stays out through the Aegis board, which covers the screen anyway
  { at: 'work', off: 0.25, x: 1.7, y: 0.5, z: -2.6, s: 0.46, c: '#D8FF3E' },
  { at: 'aegis', off: 0, x: 1.7, y: 0.5, z: -2.6, s: 0.46, c: '#4CC9FF' },
  { at: 'snapvibe', off: 0, x: 0.5, y: 0.1, z: -1.4, s: 0.6, c: '#D4AF37' },
  { at: 'designs', off: 0, x: 0.0, y: 0.32, z: -1.8, s: 0.72, c: '#D8FF3E' },
  // beside the timeline, not behind it
  { at: 'education', off: 0, x: 0.52, y: 0.04, z: -1.4, s: 0.66, c: '#D8FF3E' },
  // up the right of the closing headline, pulling into one point as it goes
  { at: 'contact', off: -0.8, x: 0.7, y: 0.4, z: 0.0, s: 1.0, c: '#D8FF3E' },
  { at: 'end', off: 0, x: 0.62, y: 0.62, z: 0.4, s: 1.1, c: '#FF4D1C' },
];

const DEG2RAD = Math.PI / 180;
const TAU = Math.PI * 2;

/* Hero portrait: width over height of the image, and where the top of his hair
   and the sole of his front shoe sit, as fractions of the image height from the top. */
const PORTRAIT_ASPECT = 1334 / 2000;
const PORTRAIT_HAIR = 0.15;
const PORTRAIT_FEET = 0.918;
// depth of the portrait plane, a little in front of the graph's hero position
const PORTRAIT_Z = 0.8;

/* These hex values are artistic constants feeding custom shader maths, not
 * physical colours. Three's default sRGB->linear conversion on Color would
 * crush them (#3A1E6E loses ~75% of its value). Declaring them as already-linear
 * keeps the shader arithmetic, and so the look, identical to the pre-migration
 * build. The line material does run the output conversion, so lines get the
 * managed value instead (see `toLine`). */
const raw = (hex: string) => new THREE.Color().setStyle(hex, THREE.LinearSRGBColorSpace);
const BONE = raw('#ECEAE3');

/** Soft round sprite, untextured points render as hard squares. */
function dotTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default function WebGLCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const labelsEl = labelsRef.current;
    if (!canvas) return;

    const SMALL = Math.min(window.innerWidth, window.innerHeight) < 700;
    const FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // No WebGL (blocked, or an old GPU): say so on the root, and the Toolkit
    // shows its full list instead of relying on labels drawn over a graph
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: !SMALL,
        powerPreference: 'high-performance',
      });
    } catch {
      document.documentElement.classList.add('no-gl');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, SMALL ? 1.75 : 2));
    // Opaque, in the page's own colour. Every light in here is additive, and on a
    // transparent canvas a glow's faint edge writes full alpha with almost no
    // colour, so it replaced the page behind it with near-black: a dark disc
    // round every dot. Nothing sits under this canvas, so opaque costs nothing.
    renderer.setClearColor('#08070a', 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 5;

    const group = new THREE.Group();
    scene.add(group);

    /* ---------- the graph ---------- */

    const L = layoutGraph();
    const N = NODES.length;
    const E = EDGES.length;

    const nodePos = new Float32Array(N * 3);
    const nodeSize = new Float32Array(N);
    const nodeBright = new Float32Array(N);
    const nodeCol = new Float32Array(N * 3);
    const cols = NODES.map(() => raw('#D8FF3E'));
    NODES.forEach((n, i) => {
      nodeSize[i] = n.hub ? 0.5 : n.key ? 0.31 : 0.24;
    });

    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePos, 3).setUsage(THREE.DynamicDrawUsage));
    nodeGeo.setAttribute('aSize', new THREE.BufferAttribute(nodeSize, 1));
    nodeGeo.setAttribute('aBright', new THREE.BufferAttribute(nodeBright, 1).setUsage(THREE.DynamicDrawUsage));
    nodeGeo.setAttribute('aColor', new THREE.BufferAttribute(nodeCol, 3).setUsage(THREE.DynamicDrawUsage));
    const nodeMat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 1 } },
      vertexShader: NODE_VERT,
      fragmentShader: NODE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const nodes = new THREE.Points(nodeGeo, nodeMat);
    nodes.frustumCulled = false; // positions are rewritten every frame
    group.add(nodes);

    const segPos = new Float32Array(E * 6);
    const segCol = new Float32Array(E * 6);
    const edgeInt = new Float32Array(E);
    const lineGeo = new LineSegmentsGeometry();
    lineGeo.setPositions(segPos);
    lineGeo.setColors(segCol);
    // setPositions/setColors wrap these arrays without copying, so the frame loop
    // writes straight into them and flags the shared buffers
    const segPosBuf = (lineGeo.attributes.instanceStart as THREE.InterleavedBufferAttribute).data;
    const segColBuf = (lineGeo.attributes.instanceColorStart as THREE.InterleavedBufferAttribute).data;
    const lineMat = new LineMaterial({
      linewidth: SMALL ? 1 : 1.25,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const lines = new LineSegments2(lineGeo, lineMat);
    lines.frustumCulled = false;
    group.add(lines);

    // the portrait is drawn before the graph so a dot behind the figure hides
    // behind it, while one drifting in front stays in front
    lines.renderOrder = 2;
    nodes.renderOrder = 3;

    // particle shell, outer radius stays well inside the camera distance so no
    // sprite drifts close enough to blow up into a big square
    const DUST = SMALL ? 700 : 1500;
    const pos = new Float32Array(DUST * 3);
    for (let i = 0; i < DUST; i++) {
      const r = 2.3 + Math.random() * 1.7;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.7;
      pos[i * 3 + 2] = r * Math.cos(ph);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    const dustTex = dotTexture();
    const dustMat = new THREE.PointsMaterial({
      color: raw('#D8FF3E'),
      size: 0.03,
      sizeAttenuation: true,
      map: dustTex,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    scene.add(dust);

    // The colour the graph glows in: the scroll track's, or a hovered project's.
    // Shared with the portrait so the light on the figure matches what it's looking at.
    const theme = { value: raw('#D8FF3E') };

    // The hero portrait is a real photograph placed in the scene itself rather than
    // layered over it, so the camera sway gives true parallax against the graph,
    // and dust drawn after it is depth-tested: some drifts in front, some behind.
    // Colour space left unset for the same reason as raw(): the shader writes these
    // values straight out, so they have to arrive untouched.
    let portraitReady = false;
    let pending = 2;
    const onPortraitTexture = () => {
      if (--pending === 0) portraitReady = true;
    };
    const texLoader = new THREE.TextureLoader();
    const portraitMap = texLoader.load('/hero/portrait.webp', onPortraitTexture);
    const portraitData = texLoader.load('/hero/portrait-data.webp', onPortraitTexture);
    const portraitMat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: portraitMap },
        uData: { value: portraitData },
        uLightPos: { value: group.position },
        uColorC: theme,
        uKey: { value: 0 },
      },
      vertexShader: PORTRAIT_VERT,
      fragmentShader: PORTRAIT_FRAG,
      transparent: true,
    });
    const portraitGeo = new THREE.PlaneGeometry(1, 1);
    const portraitMesh = new THREE.Mesh(portraitGeo, portraitMat);
    portraitMesh.renderOrder = 1;
    portraitMesh.frustumCulled = false; // visibility is managed against the scroll below
    portraitMesh.visible = false;
    scene.add(portraitMesh);
    dust.renderOrder = 4;

    // He fills the hero from its top rule down to its floor: hair just under the
    // rule, front shoe standing on the floor line. The name runs across him and
    // blends with him (difference, set on the title in CSS). Summed from offsetTop,
    // not read off rects, because the intro animates these with transforms that
    // would skew a rect read at mount.
    const brow = document.querySelector<HTMLElement>('.hero__eyebrow');
    const floor = document.querySelector<HTMLElement>('.hero__floor');
    const docTop = (el: HTMLElement) => {
      let y = 0;
      for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) y += n.offsetTop;
      return y;
    };
    let browTop = 0;
    let floorTop = 0;

    // Entrance: once the loader lifts the portrait is lit only by the graph's glow for a
    // beat, then the key light comes up.
    let litAt = -1;

    /* ---------- where the sections are ---------- */

    // Measured on every ScrollTrigger refresh, which is when pins have settled
    // their spacers and section positions are final.
    let track: { y: number; k: Key }[] = [];
    const A = { aboutTop: NaN, aboutEnd: NaN, toolkitTop: NaN, toolkitEnd: NaN, contactTop: NaN };
    const measure = () => {
      const H = window.innerHeight;
      const max = Math.max(1, document.documentElement.scrollHeight - H);
      const edge = (at: string) => {
        if (at === 'top') return 0;
        if (at === 'end') return max;
        const [id, side] = at.split('.');
        const el = document.getElementById(id);
        if (!el) return NaN;
        const r = el.getBoundingClientRect();
        return (side === 'end' ? r.bottom : r.top) + window.scrollY;
      };
      // keys whose section is missing drop out; the rest are kept in order and
      // clamped so a short section can never fold the track back on itself
      let last = -Infinity;
      track = KEYS.flatMap((k) => {
        const y = edge(k.at) + k.off * H;
        if (Number.isNaN(y)) return [];
        last = Math.max(last, Math.min(max, Math.max(0, y)));
        return [{ y: last, k }];
      });
      A.aboutTop = edge('about');
      A.aboutEnd = edge('about.end');
      A.toolkitTop = edge('toolkit');
      A.toolkitEnd = edge('toolkit.end');
      A.contactTop = edge('contact');
    };
    ScrollTrigger.addEventListener('refresh', measure);

    // Size off an observer rather than trusting innerWidth at mount: if the
    // canvas mounts before layout settles the viewport can report 0, and a
    // resize event alone may never arrive to correct it.
    let pointScale = 1;
    const resize = () => {
      if (brow && floor) {
        browTop = docTop(brow);
        floorTop = docTop(floor);
      }
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      lineMat.resolution.set(w, h);
      // gl_PointSize is in device pixels: world size times this, over depth
      pointScale = (h * renderer.getPixelRatio()) / (2 * Math.tan((camera.fov / 2) * DEG2RAD));
      measure();
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(document.documentElement);
    window.addEventListener('resize', resize);

    /* ---------- hover focus: a project's path, or a discipline ---------- */

    const focusCache = new Map<string, { nodes: Set<number>; edges: boolean[] }>();
    const getFocus = (key: string) => {
      let f = focusCache.get(key);
      if (!f) {
        f = { nodes: focusNodes(key), edges: EDGES.map((e) => edgeInFocus(e, key)) };
        focusCache.set(key, f);
      }
      return f;
    };

    const labelEls = labelsEl ? [...labelsEl.children].map((c) => c as HTMLElement) : [];
    let labelsShown = false;

    const cA = new THREE.Color();
    const cB = new THREE.Color();
    const cTarget = new THREE.Color();
    const focusCol = new THREE.Color();
    const toolCol = new THREE.Color();
    const lineCol = new THREE.Color();
    const v = new THREE.Vector3();
    const sx = new Float32Array(N);
    const sy = new Float32Array(N);

    let rotY = 0;
    let lastP = -1;
    let lastT = 0;

    const unsubscribe = subscribe((t) => {
      const p = view.scrollP;
      const y = window.scrollY;
      const H = window.innerHeight;
      const W = window.innerWidth;
      const dt = lastT ? Math.min(0.05, t - lastT) : 0;
      lastT = t;

      /* -- where on the track -- */
      let a = track[0]?.k ?? KEYS[0];
      let b = a;
      let k = 0;
      if (track.length > 1) {
        let i = 0;
        while (i < track.length - 2 && y > track[i + 1].y) i++;
        a = track[i].k;
        b = track[i + 1].k;
        const span = track[i + 1].y - track[i].y;
        k = span > 0 ? smooth(clamp01((y - track[i].y) / span)) : 1;
      }

      /* -- section states -- */
      // the lines draw while the manifesto is read
      const connectT = Number.isNaN(A.aboutTop)
        ? 1
        : clamp01((y - (A.aboutTop - 0.6 * H)) / Math.max(1, A.aboutEnd - 0.5 * H - (A.aboutTop - 0.6 * H)));
      // the toolkit holds the graph front and centre, labelled
      const toolkitT = Number.isNaN(A.toolkitTop)
        ? 0
        : smooth(
            Math.min(
              clamp01((y - (A.toolkitTop - 0.75 * H)) / (0.8 * H)),
              1 - clamp01((y - (A.toolkitEnd - 0.8 * H)) / (0.55 * H)),
            ),
          );
      // the contact section pulls every dot into one
      const convergeT = Number.isNaN(A.contactTop) ? 0 : smooth(clamp01((y - (A.contactTop - 1.3 * H)) / (0.9 * H)));

      /* -- place the graph -- */
      const px = lerp(a.x, b.x, k);
      const py = lerp(a.y, b.y, k);
      const pz = lerp(a.z, b.z, k);
      let ps = lerp(a.s, b.s, k);

      // half-extents of the camera frustum at the graph's current depth
      const halfH = Math.tan((camera.fov / 2) * DEG2RAD) * (camera.position.z - pz);
      const halfW = halfH * camera.aspect;

      // On portrait screens there is no horizontal room to park the graph in,
      // so trade lateral travel for vertical and pull the scale back a little.
      const portrait = camera.aspect < 1;
      const kx = portrait ? 0.55 : 1;
      const ky = portrait ? 2.6 : 1;
      if (portrait) ps *= 0.78;

      // kept inside the frame: the portrait stretch on y would otherwise throw the
      // upper keys off the top of a phone. A key set past the edge (|x| > 1) is
      // there to take the graph off screen, so towards one the limit and the
      // portrait squeeze both ease off.
      const offK = clamp01((Math.abs(px) - 0.85) / 0.3);
      const xLim = Math.max(0.85, Math.abs(px));
      let nx = Math.max(-xLim, Math.min(xLim, px * lerp(kx, 1, offK)));
      let ny = Math.max(-0.85, Math.min(0.85, py * ky));
      if (portrait) {
        // A phone has no side to park the toolkit's graph beside its list: it sits
        // above the list instead, shrunk to the width (the graph spans ~1.5 world
        // units either side of its centre, a little more with labels). At the end
        // the point waits in the top corner, under the nav, where nothing else
        // scrolls past by then.
        ny = lerp(ny, 0.42, toolkitT);
        ps = lerp(ps, Math.min(ps, (0.86 * halfW) / 1.55), toolkitT);
        nx = lerp(nx, 0.78, convergeT);
        ny = lerp(ny, 0.8, convergeT);
      }
      const tx = nx * halfW + pointer.x * halfW * 0.06;
      const ty = ny * halfH - pointer.y * halfH * 0.06;

      group.position.x = lerp(group.position.x, tx, 0.08);
      group.position.y = lerp(group.position.y, ty, 0.08);
      group.position.z = lerp(group.position.z, pz, 0.08);
      group.scale.setScalar(lerp(group.scale.x, ps, 0.08));

      // It turns with the scroll everywhere except the toolkit, where it eases
      // round to face you so the labels can be read. Accumulated rather than set
      // from the scroll position, so easing to the nearest front never jumps.
      if (lastP < 0) lastP = p;
      rotY += ((p - lastP) * Math.PI * 2.4 + (calmMotion ? 0 : dt * 0.06)) * (1 - toolkitT);
      lastP = p;
      const front = TAU * Math.round(rotY / TAU) + (calmMotion ? 0 : Math.sin(t * 0.3) * 0.1);
      rotY = lerp(rotY, front, 0.07 * toolkitT);
      group.rotation.y = rotY;
      group.rotation.x = lerp(Math.sin(p * Math.PI * 2) * 0.35 + pointer.y * 0.12, pointer.y * 0.05, toolkitT);

      camera.position.x = lerp(camera.position.x, pointer.x * 0.35, 0.05);
      camera.position.y = lerp(camera.position.y, -pointer.y * 0.28, 0.05);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      group.updateMatrixWorld(true);

      /* -- colour -- */
      // A hovered work row overrides the scroll track's colour. Easing toward a
      // target rather than assigning it outright means both directions cross-fade.
      if (accent.hex) {
        cTarget.setStyle(accent.hex, THREE.LinearSRGBColorSpace);
      } else {
        cA.setStyle(a.c, THREE.LinearSRGBColorSpace);
        cB.setStyle(b.c, THREE.LinearSRGBColorSpace);
        cTarget.copy(cA).lerp(cB, k);
      }
      theme.value.lerp(cTarget, 0.09);
      focusCol.setStyle(accent.hex ?? '#D8FF3E', THREE.LinearSRGBColorSpace);
      toolCol.copy(theme.value).lerp(BONE, 0.55);

      const f = accent.focus ? getFocus(accent.focus) : null;
      // a phone has no empty side for it, so outside the toolkit it sits behind
      // text and steps back to stay out of the way
      const quiet = SMALL ? lerp(0.6, 1, toolkitT) : 1;

      /* -- nodes -- */
      const drift = calmMotion ? 0 : 1;
      for (let i = 0; i < N; i++) {
        const node = NODES[i];
        const j = i * 3;
        // loose until the manifesto pulls it into the graph, each dot on its own lag
        const settle = smooth(clamp01((connectT - L.lag[i]) / 0.7));
        const gather = 1 - convergeT;
        const ph = L.phase[i];
        const amp = drift * lerp(0.07, 0.025, settle) * gather;
        nodePos[j] = lerp(L.scatter[j], L.graph[j], settle) * gather + Math.sin(t * 0.5 + ph) * amp;
        nodePos[j + 1] = lerp(L.scatter[j + 1], L.graph[j + 1], settle) * gather + Math.cos(t * 0.43 + ph * 1.3) * amp;
        nodePos[j + 2] = lerp(L.scatter[j + 2], L.graph[j + 2], settle) * gather + Math.sin(t * 0.37 + ph * 0.7) * amp;

        // where it lands on screen, for the cursor's glow and the labels
        v.set(nodePos[j], nodePos[j + 1], nodePos[j + 2]).applyMatrix4(group.matrixWorld).project(camera);
        sx[i] = (v.x * 0.5 + 0.5) * W;
        sy[i] = (-v.y * 0.5 + 0.5) * H;

        // dots near the cursor light up, like a torch passed over the board
        let prox = 0;
        if (FINE) {
          const d = Math.hypot(sx[i] - pointer.px, sy[i] - pointer.py);
          prox = Math.max(0, 1 - d / 200);
          prox *= prox;
        }

        // a slow, uneven twinkle, so the cloud reads as alive before it is connected
        let target = (node.hub ? 1 : 0.72) * (calmMotion ? 1 : 0.86 + 0.14 * Math.sin(t * 1.3 + ph * 3.1));
        if (f) target *= f.nodes.has(i) ? 1.75 : 0.22;
        // gathered into one, it is a single star, not a flare over the headline
        target *= (1 + prox * 0.9) * lerp(1, 0.3, convergeT) * quiet;
        nodeBright[i] = lerp(nodeBright[i], target, 0.1);

        cols[i].lerp(f && f.nodes.has(i) ? focusCol : node.hub ? theme.value : toolCol, 0.1);
        nodeCol[j] = cols[i].r;
        nodeCol[j + 1] = cols[i].g;
        nodeCol[j + 2] = cols[i].b;
      }
      nodeGeo.attributes.position.needsUpdate = true;
      nodeGeo.attributes.aBright.needsUpdate = true;
      nodeGeo.attributes.aColor.needsUpdate = true;
      nodeMat.uniforms.uScale.value = pointScale * group.scale.x * lerp(1, 0.55, convergeT);

      /* -- lines -- */
      for (let e = 0; e < E; e++) {
        const edge = EDGES[e];
        const ia = edge.a * 3;
        const ib = edge.b * 3;
        // each line grows from one end to the other, then shrinks away as the
        // graph collapses at the end of the page
        const grow = smooth(clamp01((connectT - L.delay[e]) / 0.35)) * (1 - convergeT);
        const o = e * 6;
        segPos[o] = nodePos[ia];
        segPos[o + 1] = nodePos[ia + 1];
        segPos[o + 2] = nodePos[ia + 2];
        segPos[o + 3] = lerp(nodePos[ia], nodePos[ib], grow);
        segPos[o + 4] = lerp(nodePos[ia + 1], nodePos[ib + 1], grow);
        segPos[o + 5] = lerp(nodePos[ia + 2], nodePos[ib + 2], grow);

        const lit = f ? f.edges[e] : false;
        let target = edge.project ? 0.55 : 0.3;
        if (f) target = lit ? 1.1 : 0.05;
        edgeInt[e] = lerp(edgeInt[e], target * grow * quiet, 0.12);

        // the line material converts its output to sRGB, so it takes the managed value
        lineCol
          .copy(lit ? focusCol : edge.project ? theme.value : toolCol)
          .convertSRGBToLinear()
          .multiplyScalar(edgeInt[e]);
        segCol[o] = lineCol.r;
        segCol[o + 1] = lineCol.g;
        segCol[o + 2] = lineCol.b;
        // fades toward the end that is still being drawn
        segCol[o + 3] = lineCol.r * 0.55;
        segCol[o + 4] = lineCol.g * 0.55;
        segCol[o + 5] = lineCol.b * 0.55;
      }
      segPosBuf.needsUpdate = true;
      segColBuf.needsUpdate = true;

      /* -- labels, in the toolkit only -- */
      if (labelsEl) {
        if (toolkitT > 0.01) {
          v.copy(group.position).project(camera);
          const cx = (v.x * 0.5 + 0.5) * W;
          labelsEl.style.opacity = toolkitT.toFixed(3);
          for (let i = 0; i < labelEls.length; i++) {
            // a hub's name sits under it, clear of the tools fanned around it;
            // a tool's name points away from the middle, the way its line does
            const right = sx[i] >= cx;
            labelEls[i].style.transform = NODES[i].hub
              ? `translate3d(${sx[i].toFixed(1)}px,${(sy[i] + 15).toFixed(1)}px,0) translate(-50%,0)`
              : `translate3d(${(sx[i] + (right ? 11 : -11)).toFixed(1)}px,${sy[i].toFixed(1)}px,0) translate(${right ? '0' : '-100%'},-50%)`;
            labelEls[i].style.opacity = f ? (f.nodes.has(i) ? '1' : '0.25') : '1';
          }
          labelsShown = true;
        } else if (labelsShown) {
          labelsEl.style.opacity = '0';
          labelsShown = false;
        }
      }

      /* -- portrait -- */
      // Measured in world units at its own depth. It trails the page by a tenth on
      // scroll so the type in front reads as the nearer layer.
      const pHalfH = Math.tan((camera.fov / 2) * DEG2RAD) * (camera.position.z - PORTRAIT_Z);
      const pHalfW = pHalfH * camera.aspect;
      const toWorld = (2 * pHalfH) / H;
      const gap = 0.02 * H;
      // narrower screens run out of width first; then the feet stay on the floor
      // line and the head simply sits lower
      const fitH = ((floorTop - browTop - gap) * toWorld) / (PORTRAIT_FEET - PORTRAIT_HAIR);
      const pH = Math.min(fitH, (0.9 * 2 * pHalfW) / PORTRAIT_ASPECT);
      const feetY = pHalfH - (floorTop - y * 0.9) * toWorld;
      const pY = feetY + (PORTRAIT_FEET - 0.5) * pH;
      portraitMesh.scale.set(pH * PORTRAIT_ASPECT, pH, 1);
      // left of centre on landscape screens so the portrait looks across at the graph
      portraitMesh.position.set((portrait ? 0 : -0.28) * pHalfW, pY, PORTRAIT_Z);
      // hidden once scrolled away, and on hero layouts too squat to fit him properly
      portraitMesh.visible = portraitReady && !!floor && pH > 0.3 * 2 * pHalfH && pY - pH / 2 < pHalfH;

      if (litAt < 0 && !document.body.classList.contains('is-loading')) litAt = t;
      const lit = calmMotion ? 1 : litAt < 0 ? 0 : smooth(clamp01((t - litAt - 0.5) / 1.4));
      portraitMat.uniforms.uKey.value = 0.06 + 0.94 * lit;

      dust.rotation.y = -t * 0.03 + p * 1.2;
      dust.rotation.x = p * 0.6;

      renderer.render(scene, camera);
    });

    return () => {
      unsubscribe();
      ScrollTrigger.removeEventListener('refresh', measure);
      ro.disconnect();
      window.removeEventListener('resize', resize);
      nodeGeo.dispose();
      nodeMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      dustGeo.dispose();
      dustMat.dispose();
      dustTex.dispose();
      portraitGeo.dispose();
      portraitMat.dispose();
      portraitMap.dispose();
      portraitData.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <>
      <canvas id="gl" ref={canvasRef} />
      {/* names for the dots, placed over the graph while the Toolkit holds it; the
          Toolkit section carries the same list as real text for screen readers */}
      <div className="graph-labels" ref={labelsRef} aria-hidden="true">
        {NODES.map((n) => (
          <span className={n.hub ? 'graph-label graph-label--hub' : 'graph-label'} key={n.id}>
            {n.label}
          </span>
        ))}
      </div>
    </>
  );
}
