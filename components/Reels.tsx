'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PROJECTS, type Project, type Frame } from '@/lib/projects';
import { subscribe, accent, lerp } from '@/lib/motion';
import { play } from '@/lib/sfx';

/* The project index as a stack of film cans, one reel per project.
 *
 * Hovering a can (or its name in the list) slides it out of the stack; picking
 * one lifts it out, turns its lid to you, slides the lid off and pulls a strip
 * of film out of the reel with three frames of the work on it. The list beside
 * the stack is the real interface: buttons, the detail panel and its links all
 * live in the DOM, the canvas is a picture of them. Without WebGL the list and
 * panel simply stand on their own.
 */

const R = 1; // can radius
const H = 0.17; // can height
const GAP = 0.014;
const N = PROJECTS.length;

const METALS: Record<Project['metal'], { color: string; roughness: number }> = {
  steel: { color: '#c3c6cc', roughness: 0.34 },
  gunmetal: { color: '#555b66', roughness: 0.38 },
  brass: { color: '#cfa64e', roughness: 0.32 },
  copper: { color: '#c07a4f', roughness: 0.36 },
};

/** Fonts come from next/font, which names them by hash; read the real family
 *  lists off the CSS variables it sets so the canvas draws in the site's type. */
function families() {
  const cs = getComputedStyle(document.documentElement);
  const get = (v: string, fb: string) => cs.getPropertyValue(v).trim() || fb;
  return {
    display: get('--font-display', 'system-ui, sans-serif'),
    serif: get('--font-serif', 'Georgia, serif'),
    mono: get('--font-mono', 'ui-monospace, monospace'),
  };
}

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  draw(ctx);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, cv, ctx };
}

/** Largest font size (up to `max`) at which `text` fits in `width`. */
function fit(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, width: number, max: number) {
  let px = max;
  ctx.font = font(px);
  while (px > 12 && ctx.measureText(text).width > width) {
    px -= 4;
    ctx.font = font(px);
  }
  return px;
}

const TAPE = '#e7ddc4';
const INK = '#1c1914';

/** Masking tape with torn ends. */
function tape(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = TAPE;
  ctx.beginPath();
  ctx.moveTo(10, 0);
  for (let y = 0; y <= h; y += h / 9) ctx.lineTo(10 + (Math.random() - 0.5) * 14, y);
  for (let y = h; y >= 0; y -= h / 9) ctx.lineTo(w - 10 + (Math.random() - 0.5) * 14, y);
  ctx.closePath();
  ctx.fill();
  // paper grain
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(90,70,40,${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 6, 1);
  }
}

function labelTexture(p: Project) {
  const f = families();
  return canvasTex(1024, 400, (ctx) => {
    tape(ctx, 1024, 400);
    ctx.fillStyle = p.accent;
    ctx.fillRect(30, 26, 22, 348);
    ctx.fillStyle = 'rgba(28,25,20,.62)';
    ctx.font = `500 34px ${f.mono}`;
    ctx.fillText(`REEL ${p.n}`, 84, 76);
    ctx.textAlign = 'right';
    ctx.fillText(p.yr.toUpperCase(), 980, 76);
    ctx.textAlign = 'left';
    ctx.fillStyle = INK;
    const title = p.title.toUpperCase();
    const px = fit(ctx, title, (s) => `900 ${s}px ${f.display}`, 890, 168);
    ctx.fillText(title, 80, 200 + px * 0.36);
    ctx.fillStyle = 'rgba(28,25,20,.62)';
    ctx.font = `500 28px ${f.mono}`;
    const role = p.cat.split('·').pop()!.trim().toUpperCase();
    ctx.fillText(role, 84, 350);
  });
}

function bandTexture(p: Project) {
  const f = families();
  return canvasTex(1024, 112, (ctx) => {
    tape(ctx, 1024, 112);
    ctx.fillStyle = p.accent;
    ctx.fillRect(26, 14, 14, 84);
    ctx.fillStyle = INK;
    ctx.font = `600 40px ${f.mono}`;
    ctx.fillText(p.n, 66, 72);
    const title = p.title.toUpperCase();
    const px = fit(ctx, title, (s) => `900 ${s}px ${f.display}`, 640, 70);
    ctx.fillText(title, 160, 56 + px * 0.36);
    ctx.font = `500 30px ${f.mono}`;
    ctx.textAlign = 'right';
    ctx.fillText(p.yr.toUpperCase(), 990, 70);
  });
}

/** Pressed concentric rings on the lid, as a colour map under the metal. */
function lidTexture() {
  return canvasTex(512, 512, (ctx) => {
    const c = 256;
    ctx.fillStyle = '#d9d9d9';
    ctx.fillRect(0, 0, 512, 512);
    for (const [r, w] of [
      [238, 8],
      [212, 3],
      [170, 10],
      [120, 3],
      [70, 6],
    ] as const) {
      ctx.lineWidth = w;
      ctx.strokeStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath();
      ctx.arc(c - 1.5, c - 1.5, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(70,70,70,.65)';
      ctx.beginPath();
      ctx.arc(c + 1.5, c + 1.5, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
}

/** Film wound on its core, seen from above with the lid off. */
function reelTexture() {
  return canvasTex(512, 512, (ctx) => {
    const c = 256;
    ctx.fillStyle = '#16110c';
    ctx.beginPath();
    ctx.arc(c, c, 252, 0, Math.PI * 2);
    ctx.fill();
    for (let r = 250; r > 62; r -= 1.6) {
      ctx.strokeStyle = `rgba(150,110,70,${0.04 + Math.random() * 0.07})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // the plastic core, with its three windows
    ctx.fillStyle = '#c8c4bc';
    ctx.beginPath();
    ctx.arc(c, c, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#16110c';
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(c + Math.cos(a) * 34, c + Math.sin(a) * 34, 13, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(c, c, 9, 0, Math.PI * 2);
    ctx.fill();
  });
}

/* The film strip: a leader with the reel's edge markings, then three frames.
   Drawn once per project when it is first picked; stills arrive as they load. */
const STRIP_H = 500;
const FRAME_W = 712;
const FRAME_H = 400;
const LEADER = 236;

function stripTexture(p: Project, STRIP_W: number) {
  const f = families();
  const made = canvasTex(STRIP_W, STRIP_H, () => {});
  const { ctx, tex } = made;
  const images: (HTMLImageElement | null)[] = [null, null, null];

  const frameX = (k: number) => LEADER + k * (FRAME_W + 70);
  const frameY = (STRIP_H - FRAME_H) / 2;

  const titleCard = (fr: Extract<Frame, { kind: 'title' }>, x: number, y: number) => {
    const g1 = ctx.createRadialGradient(x + FRAME_W * 0.75, y + FRAME_H * 0.25, 0, x + FRAME_W * 0.75, y + FRAME_H * 0.25, FRAME_W * 0.7);
    g1.addColorStop(0, p.glow[0]);
    g1.addColorStop(1, 'rgba(0,0,0,0)');
    const g2 = ctx.createRadialGradient(x + FRAME_W * 0.15, y + FRAME_H * 0.85, 0, x + FRAME_W * 0.15, y + FRAME_H * 0.85, FRAME_W * 0.8);
    g2.addColorStop(0, p.glow[1]);
    g2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = '#07060a';
    ctx.fillRect(x, y, FRAME_W, FRAME_H);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = g2;
    ctx.fillRect(x, y, FRAME_W, FRAME_H);
    ctx.fillStyle = g1;
    ctx.fillRect(x, y, FRAME_W, FRAME_H);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f2efe6';
    ctx.textAlign = 'center';
    if (fr.style === 'display') {
      const t = fr.text.toUpperCase();
      const px = fit(ctx, t, (s) => `900 ${s}px ${f.display}`, FRAME_W - 90, 150);
      ctx.fillText(t, x + FRAME_W / 2, y + FRAME_H / 2 + px * 0.36);
    } else if (fr.style === 'serif') {
      const px = fit(ctx, fr.text, (s) => `italic 400 ${s}px ${f.serif}`, FRAME_W - 110, 96);
      ctx.fillText(fr.text, x + FRAME_W / 2, y + FRAME_H / 2 + px * 0.3);
    } else {
      ctx.font = `500 54px ${f.mono}`;
      ctx.fillText(fr.text.toUpperCase().split('').join(' '), x + FRAME_W / 2, y + FRAME_H / 2 + 18);
    }
    ctx.textAlign = 'left';
  };

  const draw = () => {
    ctx.clearRect(0, 0, STRIP_W, STRIP_H);
    ctx.fillStyle = '#15100c';
    ctx.fillRect(0, 0, STRIP_W, STRIP_H);
    // sprocket holes, punched through (transparent), top and bottom
    ctx.globalCompositeOperation = 'destination-out';
    for (let x = 18; x < STRIP_W; x += 52) {
      for (const y of [14, STRIP_H - 14 - 26]) {
        ctx.beginPath();
        ctx.roundRect(x, y, 26, 26, 5);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    // edge printing, the way stock is marked
    ctx.fillStyle = '#c8913a';
    ctx.font = `500 20px ${f.mono}`;
    for (let x = 30; x < STRIP_W; x += 520) ctx.fillText(`HK ${p.n}  ${p.title.toUpperCase()}  ▸`, x, 62);
    ctx.font = `600 34px ${f.mono}`;
    ctx.fillText(`REEL ${p.n}`, 40, STRIP_H / 2 + 12);

    p.frames.forEach((fr, k) => {
      const x = frameX(k);
      const y = frameY;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, FRAME_W, FRAME_H, 18);
      ctx.clip();
      if (fr.kind === 'image') {
        const img = images[k];
        ctx.fillStyle = '#0b0a0e';
        ctx.fillRect(x, y, FRAME_W, FRAME_H);
        if (img) {
          // cover the frame, centred
          const s = Math.max(FRAME_W / img.naturalWidth, FRAME_H / img.naturalHeight);
          const w = img.naturalWidth * s;
          const h = img.naturalHeight * s;
          ctx.drawImage(img, x + (FRAME_W - w) / 2, y + (FRAME_H - h) / 2, w, h);
        }
      } else {
        titleCard(fr, x, y);
      }
      ctx.restore();
    });
    tex.needsUpdate = true;
  };

  draw();
  p.frames.forEach((fr, k) => {
    if (fr.kind !== 'image') return;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      images[k] = img;
      draw();
    };
    img.src = fr.src;
  });
  return tex;
}

/** A ribbon along a curve: the strip of film pulled out of the reel. Its
 *  width faces the camera, with a slow twist so it reads as film, not a plane. */
function ribbonGeometry(curve: THREE.Curve<THREE.Vector3>, width: number, segments: number) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const toCam = new THREE.Vector3(0, 0.25, 1).normalize();
  const t = new THREE.Vector3();
  const side = new THREE.Vector3();
  const p = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const s = i / segments;
    curve.getPointAt(s, p);
    curve.getTangentAt(s, t);
    // toCam x tangent puts the texture's top edge up when the film runs left to right
    side.crossVectors(toCam, t).normalize();
    side.applyAxisAngle(t, Math.sin(s * Math.PI * 1.5) * 0.3);
    pos.push(p.x + (side.x * width) / 2, p.y + (side.y * width) / 2, p.z + (side.z * width) / 2);
    pos.push(p.x - (side.x * width) / 2, p.y - (side.y * width) / 2, p.z - (side.z * width) / 2);
    uv.push(s, 1, s, 0);
    if (i < segments) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

type Can = {
  group: THREE.Group;
  lid: THREE.Group;
  /** resting place in the stack */
  home: { x: number; z: number; ry: number; tilt: number };
  /** animated: 0 in the stack, 1 held up to the camera */
  t: number;
  lidOpen: number;
  hover: number;
  level: number;
};

export default function Reels() {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorHook = useRef<HTMLSpanElement>(null);
  const [sel, setSel] = useState(-1);
  const [hover, setHover] = useState(-1);
  const [gl, setGl] = useState(true);

  // read by the frame loop without re-running the scene setup
  const selRef = useRef(-1);
  const hoverRef = useRef(-1);
  const api = useRef<{ select: (i: number) => void } | null>(null);

  // whatever is hovered, or else what is picked, lights its path in the graph
  useEffect(() => {
    const i = hover >= 0 ? hover : sel;
    accent.hex = i >= 0 ? PROJECTS[i].accent : null;
    accent.focus = i >= 0 ? PROJECTS[i].id : null;
  }, [hover, sel]);
  useEffect(
    () => () => {
      accent.hex = null;
      accent.focus = null;
    },
    [],
  );

  useEffect(() => {
    hoverRef.current = hover;
  }, [hover]);

  const pick = (i: number) => {
    const next = selRef.current === i ? -1 : i;
    selRef.current = next;
    setSel(next);
    api.current?.select(next);
    play('flip');
  };

  // Escape puts the reel back
  useEffect(() => {
    if (sel < 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') pick(sel);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = stage.current;
    const hook = cursorHook.current;
    if (!canvas || !host) return;
    let stop: (() => void) | undefined;
    let dead = false;
    // the labels are drawn in the site's own type, so wait for it to load
    document.fonts.ready.then(() => {
      if (!dead) stop = init(canvas, host, hook);
    });
    return () => {
      dead = true;
      stop?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function init(canvas: HTMLCanvasElement, host: HTMLDivElement, hook: HTMLSpanElement | null): (() => void) | undefined {
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch {
      setGl(false);
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    // a studio reflection for the metal, kept low so dark film stays dark
    scene.environmentIntensity = 0.55;

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
    camera.position.set(0, 2.3, 7.8);
    const look = new THREE.Vector3(0, 0.05, 0);

    const key = new THREE.DirectionalLight('#ffffff', 1.5);
    key.position.set(-3, 5, 4);
    scene.add(key);
    // a lime rim from behind, the site's own light
    const rim = new THREE.DirectionalLight('#D8FF3E', 1.1);
    rim.position.set(4, 2, -4);
    scene.add(rim);
    scene.add(new THREE.AmbientLight('#ffffff', 0.15));

    const disposables: { dispose: () => void }[] = [envTex, pmrem];
    const track = <T extends { dispose: () => void }>(x: T) => {
      disposables.push(x);
      return x;
    };

    // shared geometry
    const wallGeo = track(new THREE.CylinderGeometry(R, R, H, 72, 1, true));
    const discGeo = track(new THREE.CircleGeometry(R, 72));
    const rimGeo = track(new THREE.TorusGeometry(R, 0.013, 8, 72));
    const lidWallGeo = track(new THREE.CylinderGeometry(R * 1.014, R * 1.014, H * 0.52, 72, 1, true));
    const lidTopGeo = track(new THREE.CircleGeometry(R * 1.014, 72));
    const lidRimGeo = track(new THREE.TorusGeometry(R * 1.014, 0.016, 8, 72));
    const labelGeo = track(new THREE.PlaneGeometry(1.28, 0.5));
    const bandGeo = track(new THREE.CylinderGeometry(R * 1.022, R * 1.022, H * 0.4, 48, 1, true, -0.62, 1.24));
    const reelGeo = track(new THREE.CircleGeometry(R * 0.95, 72));

    const lidMap = track(lidTexture().tex);
    const reelMap = track(reelTexture().tex);
    const reelMat = track(new THREE.MeshStandardMaterial({ map: reelMap, roughness: 0.85, metalness: 0, envMapIntensity: 0.3 }));

    // a soft contact shadow under the stack
    const shadowTex = track(
      canvasTex(256, 256, (ctx) => {
        const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
        g.addColorStop(0, 'rgba(0,0,0,.55)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 256, 256);
      }).tex,
    );
    const shadow = new THREE.Mesh(
      track(new THREE.PlaneGeometry(3.6, 3.6)),
      track(new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })),
    );
    shadow.rotation.x = -Math.PI / 2;
    scene.add(shadow);

    const stackBase = -((N - 1) * (H + GAP)) / 2;
    shadow.position.y = stackBase - H / 2 - 0.01;

    const rnd = (a: number) => (Math.random() - 0.5) * a;
    const cans: Can[] = PROJECTS.map((p, i) => {
      const m = METALS[p.metal];
      const metal = track(new THREE.MeshStandardMaterial({ color: m.color, metalness: 1, roughness: m.roughness }));
      const lidMetal = track(
        new THREE.MeshStandardMaterial({ color: m.color, map: lidMap, metalness: 1, roughness: m.roughness + 0.04 }),
      );
      const group = new THREE.Group();
      group.userData.index = i;

      const wall = new THREE.Mesh(wallGeo, metal);
      const bottom = new THREE.Mesh(discGeo, metal);
      bottom.rotation.x = Math.PI / 2;
      bottom.position.y = -H / 2;
      const lip = new THREE.Mesh(rimGeo, metal);
      lip.rotation.x = Math.PI / 2;
      lip.position.y = H / 2 - 0.01;
      const reel = new THREE.Mesh(reelGeo, reelMat);
      reel.rotation.x = -Math.PI / 2;
      reel.position.y = H / 2 - 0.03;
      group.add(wall, bottom, lip, reel);

      const lid = new THREE.Group();
      const lidWall = new THREE.Mesh(lidWallGeo, metal);
      lidWall.position.y = H / 2 - H * 0.26 + 0.006;
      const lidTop = new THREE.Mesh(lidTopGeo, lidMetal);
      lidTop.rotation.x = -Math.PI / 2;
      lidTop.position.y = H / 2 + 0.006;
      const lidRim = new THREE.Mesh(lidRimGeo, metal);
      lidRim.rotation.x = Math.PI / 2;
      lidRim.position.y = H / 2 + 0.002;
      const label = new THREE.Mesh(
        labelGeo,
        track(new THREE.MeshStandardMaterial({ map: track(labelTexture(p).tex), roughness: 0.85, transparent: true, alphaTest: 0.4 })),
      );
      label.rotation.x = -Math.PI / 2;
      label.rotation.z = rnd(0.12);
      label.position.y = H / 2 + 0.009;
      const band = new THREE.Mesh(
        bandGeo,
        track(new THREE.MeshStandardMaterial({ map: track(bandTexture(p).tex), roughness: 0.85, transparent: true, alphaTest: 0.4 })),
      );
      band.position.y = H / 2 - H * 0.26 + 0.006;
      lid.add(lidWall, lidTop, lidRim, label, band);
      group.add(lid);
      scene.add(group);

      return {
        group,
        lid,
        home: { x: rnd(0.16), z: rnd(0.16), ry: rnd(0.5), tilt: rnd(0.03) },
        t: 0,
        lidOpen: 0,
        hover: 0,
        level: N - 1 - i,
      };
    });

    /* The film strip, one ribbon reused by every reel. It flows from the open
       reel, which is held up to the camera top left, down across the stage. */
    // out of the reel's lower left, under, and along the bottom left to right,
    // so the frames on the long run read the right way up
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.98, -0.02, 0.92),
      new THREE.Vector3(-1.4, -0.66, 1.05),
      new THREE.Vector3(-0.78, -1.18, 1.15),
      new THREE.Vector3(0.35, -1.3, 1.1),
      new THREE.Vector3(1.35, -1.14, 1.0),
      new THREE.Vector3(1.95, -0.82, 0.85),
    ]);
    const SEG = 260;
    const FILM = 0.72;
    const stripGeo = track(ribbonGeometry(curve, FILM, SEG));
    // the strip texture is as long as the path, so frames keep their shape
    const stripW = Math.round((curve.getLength() / FILM) * STRIP_H);
    const stripMat = track(
      new THREE.MeshStandardMaterial({
        roughness: 0.45,
        metalness: 0,
        side: THREE.DoubleSide,
        transparent: true,
        alphaTest: 0.5,
        emissive: new THREE.Color('#ffffff'),
        emissiveIntensity: 0.5,
      }),
    );
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.visible = false;
    scene.add(strip);
    const stripTexes = new Map<number, THREE.Texture>();
    const stripFor = (i: number) => {
      let tx = stripTexes.get(i);
      if (!tx) {
        tx = track(stripTexture(PROJECTS[i], stripW));
        stripTexes.set(i, tx);
      }
      return tx;
    };
    const film = { progress: 0 };

    // the pose a picked reel is held in: up, forward, lid to the camera
    const HELD = { x: -0.62, y: 0.62, z: 0.55, rx: Math.PI / 2 - 0.34, ry: 0.32, rz: -0.1, s: 0.9 };
    const pile = { shift: 0 };

    /* -- choreography -- */
    let current = -1;
    const D = calm ? 0 : 1;
    const select = (i: number) => {
      const prev = current;
      current = i;
      gsap.killTweensOf(film);
      if (prev >= 0) {
        const c = cans[prev];
        gsap.killTweensOf(c);
        gsap
          .timeline()
          .to(film, { progress: 0, duration: 0.35 * D, ease: 'power2.in' })
          .to(c, { lidOpen: 0, duration: 0.35 * D, ease: 'power2.inOut' }, 0.1 * D)
          .to(c, { t: 0, duration: 0.7 * D, ease: 'power3.inOut' }, 0.3 * D);
      }
      gsap.to(pile, { shift: i >= 0 ? 1 : 0, duration: 0.9 * D, ease: 'power3.inOut' });
      if (i < 0) return;
      const c = cans[i];
      gsap.killTweensOf(c);
      stripMat.map = stripFor(i);
      stripMat.emissiveMap = stripMat.map;
      stripMat.needsUpdate = true;
      gsap
        .timeline({ delay: prev >= 0 ? 0.35 * D : 0 })
        .to(c, { t: 1, duration: 0.85 * D, ease: 'power3.inOut' })
        .to(c, { lidOpen: 1, duration: 0.55 * D, ease: 'power2.inOut' }, '-=0.15')
        .fromTo(film, { progress: 0 }, { progress: 1, duration: 1.1 * D, ease: 'power2.out' }, '-=0.2');
    };
    api.current = { select };

    /* -- picking -- */
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    /** The can under the pointer, STRIP for the film, or -1 for nothing. */
    const STRIP = -2;
    const hitTest = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects([...cans.map((c) => c.group), strip], true)[0];
      if (hit?.object === strip) return strip.visible ? STRIP : -1;
      let o: THREE.Object3D | null = hit?.object ?? null;
      while (o && o.userData.index === undefined) o = o.parent;
      return o ? (o.userData.index as number) : -1;
    };
    // The custom cursor listens for enter/leave on [data-cursor] elements; the
    // cans aren't elements, so a hidden stand-in carries their label for them.
    let cursorOn = false;
    const cursor = (label: string | null) => {
      if (!hook) return;
      if (label) {
        hook.dataset.cursor = label;
        hook.dispatchEvent(new MouseEvent('mouseenter'));
      } else if (cursorOn) {
        hook.dispatchEvent(new MouseEvent('mouseleave'));
      }
      cursorOn = !!label;
    };
    let downAt = { x: 0, y: 0 };
    let lastHit = -1;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const i = hitTest(e);
      const can = i >= 0 ? i : -1;
      if (can !== hoverRef.current) setHover(can);
      if (i !== lastHit) {
        lastHit = i;
        cursor(i < 0 ? null : i === selRef.current ? 'back' : 'pull');
      }
    };
    const onLeave = () => {
      setHover(-1);
      lastHit = -1;
      cursor(null);
    };
    const onDown = (e: PointerEvent) => {
      downAt = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return;
      const i = hitTest(e);
      if (i === STRIP) return;
      if (i >= 0) pickRef.current(i);
      else if (selRef.current >= 0) pickRef.current(selRef.current);
      // what the can under the cursor would do has just flipped
      if (e.pointerType === 'mouse' && i >= 0) cursor(i === selRef.current ? 'back' : 'pull');
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);

    /* -- size and visibility -- */
    let visible = false;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { rootMargin: '120px' });
    io.observe(host);
    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // keep the whole stack and the strip in frame on narrow stages
      camera.fov = camera.aspect < 0.9 ? 30 + (0.9 - camera.aspect) * 26 : 30;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    /* -- frame loop -- */
    const unsubscribe = subscribe((time) => {
      if (!visible) return;
      const held = current;
      // levels: the picked reel leaves a gap that the cans above drop into
      let lv = 0;
      for (let i = N - 1; i >= 0; i--) {
        const target = i === held ? cans[i].level : lv++;
        cans[i].level = lerp(cans[i].level, target, 0.12);
      }
      cans.forEach((c, i) => {
        c.hover = lerp(c.hover, hoverRef.current === i && i !== held ? 1 : 0, 0.14);
        const ps = pile.shift;
        // resting pose: stacked, nudged out when hovered, and moved aside while
        // another reel is held up
        const sx = c.home.x + c.hover * 0.06 + ps * 1.45;
        const sy = stackBase + c.level * (H + GAP) - ps * 0.7;
        const sz = c.home.z + c.hover * 0.42 - ps * 1.6;
        const srx = c.home.tilt + c.hover * 0.1;
        const sry = c.home.ry + (calm ? 0 : Math.sin(time * 0.4 + i) * 0.02);
        const k = c.t * c.t * (3 - 2 * c.t);
        c.group.position.set(lerp(sx, HELD.x, k), lerp(sy, HELD.y, k), lerp(sz, HELD.z, k));
        c.group.rotation.set(lerp(srx, HELD.rx, k), lerp(sry, HELD.ry, k), lerp(0, HELD.rz, k));
        c.group.scale.setScalar(lerp(1 - ps * 0.22 * (i === held ? 0 : 1), HELD.s, k));
        // the lid comes off and is set aside, leaning
        const o = c.lidOpen;
        c.lid.position.set(o * 1.38, -o * 0.22, -o * 0.36);
        c.lid.rotation.set(o * -0.35, o * 0.2, o * -0.3);
      });
      shadow.position.x = pile.shift * 1.45;
      shadow.position.z = -pile.shift * 1.6;
      shadow.position.y = stackBase - H / 2 - 0.01 - pile.shift * 0.7;
      shadow.material.opacity = 1 - pile.shift * 0.35;

      strip.visible = film.progress > 0.002;
      if (strip.visible) stripGeo.setDrawRange(0, Math.floor(film.progress * SEG) * 6);

      camera.position.x = lerp(camera.position.x, 0, 0.05);
      camera.lookAt(look);
      renderer.render(scene, camera);
    });

    return () => {
      unsubscribe();
      io.disconnect();
      ro.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      gsap.killTweensOf([film, pile, ...cans]);
      cursor(null);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      api.current = null;
    };
  }

  // the canvas handlers are bound once; route clicks through the latest pick
  const pickRef = useRef(pick);
  pickRef.current = pick;

  const p = sel >= 0 ? PROJECTS[sel] : null;

  return (
    <div className={`reels${gl ? '' : ' reels--flat'}${sel >= 0 ? ' has-pick' : ''}`} ref={root}>
      <div className="reels__side">
        <ol className="reels__index">
          {PROJECTS.map((x, i) => (
            <li key={x.id}>
              <button
                type="button"
                className={`reels__item${hover === i ? ' is-hover' : ''}`}
                aria-pressed={sel === i}
                aria-controls="reel-detail"
                data-cursor="view"
                onClick={() => pick(i)}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(-1)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(-1)}
              >
                <span className="mono reels__n">{x.n}</span>
                <span className="reels__name">{x.title}</span>
                <span className="mono reels__yr">{x.yr}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="reels__detail" id="reel-detail" aria-live="polite">
          {p ? (
            <>
              <p className="mono reels__cat">
                Reel {p.n} · {p.cat}
              </p>
              {p.blurb && <p className="reels__blurb">{p.blurb}</p>}
              <div className="reels__actions">
                {p.link && (
                  <a className="reels__cta mono" href={p.link.href} data-cursor="hover">
                    {p.link.label}
                  </a>
                )}
                <button type="button" className="reels__back mono" data-cursor="hover" onClick={() => pick(sel)}>
                  Put it back
                </button>
              </div>
            </>
          ) : (
            <p className="mono reels__hint">Pull a reel out of the stack. Each one is a project.</p>
          )}
        </div>
      </div>

      <div className="reels__stage" ref={stage} aria-hidden="true">
        <canvas ref={canvasRef} />
        <span className="reels__cursor" ref={cursorHook} data-cursor="pull" hidden />
      </div>
    </div>
  );
}
