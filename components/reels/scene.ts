import * as THREE from 'three';
import gsap from 'gsap';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PROJECTS, type Project } from '@/lib/projects';
import { subscribe, lerp } from '@/lib/motion';
import { bandTexture, canvasTex, glowTexture, labelTexture, lidTexture, reelFaceTexture } from './textures';
import { buildProjector, buildReel } from './projector';
import { buildBeam } from './beam';

/* The projection room behind the screen. Two things share one canvas that
 * covers the whole stage:
 *
 *  - the table, a band along the bottom of the stage (wherever the .reels__table
 *    spacer sits), drawn in 3D: the stack of film cans and the projector;
 *  - the light, drawn flat over everything: from the projector's lens to the
 *    edges of the screen, a DOM element above the band.
 *
 * Loading a reel takes its can out of the stack, sets the lid on the pile, lifts
 * the reel out and flies it onto the projector, threads it and brings the lamp
 * up. Every step is a number between 0 and 1 that the frame loop turns into a
 * pose, so a load can be interrupted at any point and simply played backwards.
 */

const R = 1; // can radius
const H = 0.17; // can height
const GAP = 0.014;
const N = PROJECTS.length;
const SMOOTH = (t: number) => t * t * (3 - 2 * t);

const METALS: Record<Project['metal'], { color: string; roughness: number }> = {
  steel: { color: '#c3c6cc', roughness: 0.34 },
  gunmetal: { color: '#555b66', roughness: 0.38 },
  brass: { color: '#cfa64e', roughness: 0.32 },
  copper: { color: '#c07a4f', roughness: 0.36 },
};

export type ReelScene = {
  /** take reel `i` to the projector (putting any other back first); `onLamp`
   *  fires as the lamp comes up */
  load: (i: number, onLamp: () => void) => void;
  /** put the loaded reel back in its can */
  eject: () => void;
  dispose: () => void;
};

type Opts = {
  canvas: HTMLCanvasElement;
  /** the canvas's box */
  stage: HTMLElement;
  /** where on the stage the table is drawn */
  table: HTMLElement;
  /** where the light lands */
  screen: HTMLElement;
  /** a hidden [data-cursor] element that carries the canvas's cursor label */
  hook: HTMLElement | null;
  calm: boolean;
  /** what the list beside the stage is hovering */
  listHover: () => number;
  onHover: (i: number) => void;
  onPick: (i: number) => void;
  onEject: () => void;
};

type Can = {
  group: THREE.Group;
  lid: THREE.Group;
  reel: THREE.Group;
  /** resting place in the stack */
  home: { x: number; z: number; ry: number; tilt: number };
  level: number;
  hover: number;
  /** 0 in the stack, 1 standing on the table beside it */
  out: number;
  /** 0 on its can, 1 set down on top of the stack */
  lidOff: number;
  /** the reel raised clear of its can */
  lift: number;
  /** 0 in its can, 1 on the projector */
  fly: number;
  spin: number;
};

export function createReelScene(o: Opts): ReelScene | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: o.canvas, antialias: true, alpha: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 0);

  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(x: T) => {
    disposables.push(x);
    return x;
  };

  const scene = new THREE.Scene();
  const pmrem = track(new THREE.PMREMGenerator(renderer));
  scene.environment = track(pmrem.fromScene(new RoomEnvironment(), 0.04).texture);
  // a studio reflection for the metal, kept low so the room stays dark
  scene.environmentIntensity = 0.5;

  const camera = new THREE.PerspectiveCamera(26, 3, 0.1, 80);
  const key = new THREE.DirectionalLight('#ffffff', 1.5);
  key.position.set(-3, 6, 5);
  const rim = new THREE.DirectionalLight('#D8FF3E', 0.9);
  rim.position.set(4, 3, -5);
  scene.add(key, rim, new THREE.AmbientLight('#ffffff', 0.18));

  /* -- the cans -- */
  const wallGeo = track(new THREE.CylinderGeometry(R, R, H, 72, 1, true));
  const discGeo = track(new THREE.CircleGeometry(R, 72));
  const rimGeo = track(new THREE.TorusGeometry(R, 0.013, 8, 72));
  const lidWallGeo = track(new THREE.CylinderGeometry(R * 1.014, R * 1.014, H * 0.52, 72, 1, true));
  const lidTopGeo = track(new THREE.CircleGeometry(R * 1.014, 72));
  const lidRimGeo = track(new THREE.TorusGeometry(R * 1.014, 0.016, 8, 72));
  const labelGeo = track(new THREE.PlaneGeometry(1.28, 0.5));
  const bandGeo = track(new THREE.CylinderGeometry(R * 1.022, R * 1.022, H * 0.4, 48, 1, true, -0.62, 1.24));
  const lidMap = track(lidTexture().tex);
  const fullFace = track(reelFaceTexture(1).tex);
  const emptyFace = track(reelFaceTexture(0.12).tex);

  // soft contact shadows on the table
  const shadowTex = track(
    canvasTex(256, 256, (ctx) => {
      const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      g.addColorStop(0, 'rgba(0,0,0,.6)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
    }).tex,
  );
  const shadow = (w: number, d: number) => {
    const m = new THREE.Mesh(
      track(new THREE.PlaneGeometry(w, d)),
      track(new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.002;
    scene.add(m);
    return m;
  };
  const stackShadow = shadow(3.4, 3.4);
  const benchShadow = shadow(3, 3);

  const rnd = (a: number) => (Math.random() - 0.5) * a;
  const cans: Can[] = PROJECTS.map((p, i) => {
    const m = METALS[p.metal];
    const metal = track(new THREE.MeshStandardMaterial({ color: m.color, metalness: 1, roughness: m.roughness, side: THREE.DoubleSide }));
    const lidMetal = track(new THREE.MeshStandardMaterial({ color: m.color, map: lidMap, metalness: 1, roughness: m.roughness + 0.04 }));

    const group = new THREE.Group();
    group.userData.can = i;
    const wall = new THREE.Mesh(wallGeo, metal);
    const bottom = new THREE.Mesh(discGeo, metal);
    bottom.rotation.x = -Math.PI / 2;
    bottom.position.y = -H / 2;
    const lip = new THREE.Mesh(rimGeo, metal);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = H / 2 - 0.01;
    group.add(wall, bottom, lip);
    scene.add(group);

    const lid = new THREE.Group();
    lid.userData.can = i;
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
    scene.add(lid);

    const reel = buildReel(track, fullFace, 0.86);
    reel.visible = false;
    scene.add(reel);

    return {
      group,
      lid,
      reel,
      home: { x: rnd(0.16), z: rnd(0.16), ry: rnd(0.5), tilt: rnd(0.03) },
      level: N - 1 - i,
      hover: 0,
      out: 0,
      lidOff: 0,
      lift: 0,
      fly: 0,
      spin: Math.random() * 6,
    };
  });

  /* -- the projector -- */
  const projector = buildProjector(track, emptyFace);
  projector.group.rotation.y = 0.8;
  scene.add(projector.group);
  const projShadow = shadow(5.6, 3.2);

  /* -- the light -- */
  const beam = buildBeam(track, track(glowTexture().tex));
  const beamColor = new THREE.Color('#fff4e2');

  /* -- the table: the projector on the left, the stack on the right, and the
     spot between them where a can is set down to be opened. On a wide band
     they move apart, which also sends the light up more of a diagonal. -- */
  const S = { x: 3.1, z: -0.35 };
  const B = { x: 0.7, z: 0.75 };
  const body = projector.mount.parent!;
  const keep: THREE.Vector3[] = [];
  const centre = new THREE.Vector3();
  const probe = new THREE.Vector3();
  const place = (aspect: number) => {
    const spread = THREE.MathUtils.clamp((aspect - 2) * 1.1, 0, 1.4);
    S.x = 3.1 + spread * 0.6;
    B.x = S.x - 2.4;
    projector.group.position.set(-2.7 - spread, 0, 0.15);
    projector.group.updateMatrixWorld(true);
    stackShadow.position.set(S.x, 0.002, S.z);
    benchShadow.position.set(B.x, 0.003, B.z);
    projShadow.position.set(-2.5 - spread, 0.002, 0);
    projShadow.rotation.z = 0.8;

    // what the camera has to keep in view: the body and lens, both reels up,
    // the stack with a spare lid on top and a can nudged out, and the bench
    keep.length = 0;
    const at = (x: number, y: number, z: number) => keep.push(body.localToWorld(new THREE.Vector3(x, y, z)));
    for (const x of [-2.25, 1.5]) for (const y of [-0.05, 1.2]) for (const z of [-0.55, 0.55]) at(x, y, z);
    for (const y of [0.36, 0.96]) for (const z of [-0.3, 0.3]) at(2.33, y, z);
    for (const cx of [0.92, -1.32]) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        for (const z of [0.55, 0.69]) at(cx + Math.cos(a) * 0.95, 2.42 + Math.sin(a) * 0.95, z);
      }
    }
    for (const [cx, cz, top, front] of [
      [S.x, S.z, N * (H + GAP) + 0.25, 0.45],
      [B.x, B.z, 0.45, 0],
    ]) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const z = cz + Math.sin(a) * 1.08 + (Math.sin(a) > 0 ? front : 0);
        for (const y of [0, top]) keep.push(new THREE.Vector3(cx + Math.cos(a) * 1.08, y, z));
      }
    }
    new THREE.Box3().setFromPoints(keep).getCenter(centre);
  };

  /* -- layout: where the table and the screen are on the canvas -- */
  const view = { w: 1, h: 1, band: { x: 0, y: 0, w: 1, h: 1 }, rect: { left: 0, bottom: 0, right: 1, top: 1 } };
  const measure = () => {
    const c = o.stage.getBoundingClientRect();
    const t = o.table.getBoundingClientRect();
    const s = o.screen.getBoundingClientRect();
    if (!c.width || !c.height) return;
    if (c.width !== view.w || c.height !== view.h) renderer.setSize(c.width, c.height, false);
    view.w = c.width;
    view.h = c.height;
    view.band = { x: t.left - c.left, y: c.bottom - t.bottom, w: Math.max(1, t.width), h: Math.max(1, t.height) };
    view.rect = { left: s.left - c.left, right: s.right - c.left, top: c.bottom - s.top, bottom: c.bottom - s.bottom };

    // frame the table from a little above: back off until everything that has
    // to be seen sits inside the band, however wide or narrow it is
    camera.aspect = view.band.w / view.band.h;
    camera.updateProjectionMatrix();
    place(camera.aspect);
    const elev = 0.44;
    let d = 14;
    for (let k = 0; k < 5; k++) {
      camera.position.set(centre.x, centre.y + d * Math.sin(elev), centre.z + d * Math.cos(elev));
      camera.lookAt(centre);
      camera.updateMatrixWorld();
      let m = 0;
      for (const q of keep) {
        probe.copy(q).project(camera);
        m = Math.max(m, Math.abs(probe.x), Math.abs(probe.y));
      }
      d *= m / 0.94;
    }
  };
  const ro = new ResizeObserver(measure);
  [o.stage, o.table, o.screen].forEach((el) => ro.observe(el));
  measure();

  /* -- choreography -- */
  const st = { lamp: 0, thread: 0, run: 0 };
  let current = -1;
  let master: gsap.core.Timeline | null = null;

  /* A tween that only takes as long as the distance it actually covers, so
     turning back half way is quick, and that is left out if there is nothing to
     cover. Distances are measured from where the steps already queued in this
     timeline will have left things, not from where they are now. */
  let plan = new Map<object, Record<string, number>>();
  const step = (
    tl: gsap.core.Timeline,
    target: object,
    vars: Record<string, number>,
    dur: number,
    pos?: string,
    ease = 'power2.inOut',
  ) => {
    const now = target as Record<string, number>;
    const was = plan.get(target) ?? {};
    let delta = 0;
    for (const k in vars) delta = Math.max(delta, Math.abs((was[k] ?? now[k]) - vars[k]));
    plan.set(target, { ...was, ...vars });
    if (delta < 1e-3) return;
    tl.to(target, { ...vars, duration: dur * delta, ease }, pos);
  };

  const putBack = (tl: gsap.core.Timeline, i: number) => {
    const c = cans[i];
    step(tl, st, { lamp: 0, run: 0 }, 0.35);
    step(tl, st, { thread: 0 }, 0.4, '<0.1');
    step(tl, c, { out: 1 }, 0.6, '<');
    step(tl, c, { lidOff: 1 }, 0.45, '>-0.15');
    step(tl, c, { lift: 1 }, 0.2, '<');
    step(tl, c, { fly: 0 }, 0.85);
    step(tl, c, { lift: 0 }, 0.25, undefined, 'power2.in');
    step(tl, c, { lidOff: 0 }, 0.4);
    step(tl, c, { out: 0 }, 0.6, '>-0.1');
  };

  /* Reduced motion: no journey at all, things are simply where they end up. */
  const settle = (loaded: number) => {
    master?.kill();
    master = null;
    cans.forEach((c, k) => {
      c.out = 0;
      c.lidOff = 0;
      c.lift = c.fly = k === loaded ? 1 : 0;
    });
    st.lamp = st.thread = loaded >= 0 ? 1 : 0;
    st.run = 0;
    current = loaded;
  };

  const load = (i: number, onLamp: () => void) => {
    if (o.calm) {
      settle(i);
      onLamp();
      return;
    }
    master?.kill();
    plan = new Map();
    const tl = gsap.timeline();
    master = tl;
    if (current >= 0 && current !== i) putBack(tl, current);
    // anything half-way out of its can goes back too
    cans.forEach((c, k) => {
      if (k !== i && k !== current && (c.out > 0 || c.fly > 0)) putBack(tl, k);
    });
    current = i;
    const c = cans[i];
    step(tl, c, { out: 1 }, 0.6);
    step(tl, c, { lidOff: 1 }, 0.45, '>-0.15');
    step(tl, c, { lift: 1 }, 0.3, '>-0.1', 'power2.out');
    step(tl, c, { fly: 1 }, 0.9);
    step(tl, c, { lidOff: 0 }, 0.4);
    step(tl, c, { out: 0 }, 0.6, '>-0.1');
    step(tl, st, { thread: 1 }, 0.5, '<', 'power1.inOut');
    tl.call(onLamp);
    step(tl, st, { lamp: 1 }, 0.55, undefined, 'power1.in');
    step(tl, st, { run: 1 }, 0.7, '<');
  };

  const eject = () => {
    if (o.calm) {
      settle(-1);
      return;
    }
    master?.kill();
    plan = new Map();
    const tl = gsap.timeline();
    master = tl;
    cans.forEach((c, k) => {
      if (k === current || c.out > 0 || c.fly > 0) putBack(tl, k);
    });
    current = -1;
  };

  /* -- pointing at things -- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const PROJ = -2;
  const hitTest = (e: PointerEvent) => {
    const c = o.canvas.getBoundingClientRect();
    const x = e.clientX - c.left - view.band.x;
    const y = c.bottom - e.clientY - view.band.y;
    if (x < 0 || y < 0 || x > view.band.w || y > view.band.h) return -1;
    ndc.set((x / view.band.w) * 2 - 1, (y / view.band.h) * 2 - 1);
    ray.setFromCamera(ndc, camera);
    const targets: THREE.Object3D[] = [...projector.hit];
    cans.forEach((can) => targets.push(can.group, can.lid));
    if (current >= 0) targets.push(cans[current].reel);
    const hit = ray.intersectObjects(targets, true)[0];
    if (!hit) return -1;
    let ob: THREE.Object3D | null = hit.object;
    while (ob && ob.userData.can === undefined && ob !== projector.group && ob !== scene) ob = ob.parent;
    if (ob && ob.userData.can !== undefined) return ob.userData.can as number;
    return PROJ;
  };
  let cursorOn = false;
  const cursor = (label: string | null) => {
    if (!o.hook) return;
    if (label) {
      o.hook.dataset.cursor = label;
      o.hook.dispatchEvent(new MouseEvent('mouseenter'));
    } else if (cursorOn) {
      o.hook.dispatchEvent(new MouseEvent('mouseleave'));
    }
    cursorOn = !!label;
  };
  let canvasHover = -1;
  let lastHit = -1;
  const labelFor = (h: number) => (h === PROJ ? (current >= 0 ? 'eject' : null) : h >= 0 ? (h === current ? 'eject' : 'load') : null);
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const h = hitTest(e);
    const can = h >= 0 ? h : -1;
    if (can !== canvasHover) {
      canvasHover = can;
      o.onHover(can);
    }
    if (h !== lastHit) {
      lastHit = h;
      cursor(labelFor(h));
    }
  };
  const onLeave = () => {
    canvasHover = -1;
    o.onHover(-1);
    lastHit = -1;
    cursor(null);
  };
  let downAt = { x: 0, y: 0 };
  const onDown = (e: PointerEvent) => {
    downAt = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return;
    const h = hitTest(e);
    if (h >= 0) o.onPick(h);
    else if (h === PROJ && current >= 0) o.onEject();
    else return;
    if (e.pointerType === 'mouse') {
      lastHit = -1;
      // what the thing under the cursor would do next has just flipped
      queueMicrotask(() => cursor(labelFor(h)));
    }
  };
  o.canvas.addEventListener('pointermove', onMove);
  o.canvas.addEventListener('pointerleave', onLeave);
  o.canvas.addEventListener('pointerdown', onDown);
  o.canvas.addEventListener('pointerup', onUp);

  /* -- frame loop -- */
  let visible = false;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { rootMargin: '120px' });
  io.observe(o.stage);

  const v = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const ctrl = new THREE.Vector3();
  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  const qSpin = new THREE.Quaternion();
  const zAxis = new THREE.Vector3(0, 0, 1);
  const inCan = new THREE.Matrix4();
  const faceUp = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
  const lensPx = new THREE.Vector3();
  let last = performance.now();

  /** quadratic Bézier from a through c to b */
  const arc = (out: THREE.Vector3, p0: THREE.Vector3, c: THREE.Vector3, p1: THREE.Vector3, t: number) => {
    const u = 1 - t;
    return out.set(
      u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
      u * u * p0.y + 2 * u * t * c.y + t * t * p1.y,
      u * u * p0.z + 2 * u * t * c.z + t * t * p1.z,
    );
  };

  const unsubscribe = subscribe((time) => {
    if (!visible) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    // the stack closes up over a can that is out, and opens again for it
    let lv = 0;
    let inStack = 0;
    for (let i = N - 1; i >= 0; i--) {
      const c = cans[i];
      const away = c.out > 0.5;
      const want = away ? c.level : lv++;
      if (!away) inStack++;
      c.level = lerp(c.level, want, 0.12);
    }
    const topY = H / 2 + (inStack - 1) * (H + GAP);
    const listHover = o.listHover();

    let benchOut = 0;
    cans.forEach((c, i) => {
      const hovered = (listHover === i || canvasHover === i) && c.out < 0.01 && i !== current;
      c.hover = lerp(c.hover, hovered ? 1 : 0, 0.14);
      const k = SMOOTH(c.out);
      benchOut = Math.max(benchOut, k);

      // in the stack: nudged towards you when hovered
      a.set(S.x + c.home.x, H / 2 + c.level * (H + GAP), S.z + c.home.z + c.hover * 0.45);
      // out: forward first, then across onto the table
      b.set(B.x, H / 2, B.z);
      ctrl.set(a.x, a.y, a.z + 1.7);
      arc(v, a, ctrl, b, k);
      c.group.position.copy(v);
      c.group.rotation.set(lerp(c.home.tilt + c.hover * 0.08, 0, k), lerp(c.home.ry + (o.calm ? 0 : Math.sin(time * 0.4 + i) * 0.02), 0.2, k), 0);
      c.group.updateMatrixWorld();

      // the lid: on its can, or set down on top of the stack
      const l = SMOOTH(c.lidOff);
      if (l < 0.001) {
        c.lid.position.copy(c.group.position);
        c.lid.quaternion.copy(c.group.quaternion);
      } else {
        a.copy(c.group.position);
        b.set(S.x - 0.05, topY + 0.094, S.z + 0.05);
        ctrl.set((a.x + b.x) / 2, Math.max(a.y, b.y) + 1.1, (a.z + b.z) / 2 + 0.3);
        arc(v, a, ctrl, b, l);
        c.lid.position.copy(v);
        c.lid.rotation.set(Math.sin(l * Math.PI) * -0.5, lerp(c.group.rotation.y, 0.9, l), 0);
      }

      // the reel: in its can, on its way, or turning on the projector
      const onReel = c.fly > 0 || c.lift > 0 || c.lidOff > 0.02;
      c.reel.visible = onReel;
      if (!onReel) return;
      if (c.fly > 0.001 && st.run > 0 && i === current) c.spin -= dt * 1.5 * st.run;
      qSpin.setFromAxisAngle(zAxis, c.spin);
      inCan.makeTranslation(0, -0.005 + SMOOTH(c.lift) * 0.5, 0).multiply(faceUp);
      inCan.premultiply(c.group.matrixWorld);
      inCan.decompose(a, qa, v);
      if (c.fly >= 0.999) {
        projector.mount.getWorldPosition(b);
        projector.mount.getWorldQuaternion(qb);
        c.reel.position.copy(b);
        c.reel.quaternion.copy(qb).multiply(qSpin);
      } else if (c.fly > 0.001) {
        projector.mount.getWorldPosition(b);
        projector.mount.getWorldQuaternion(qb);
        const f = SMOOTH(c.fly);
        ctrl.set((a.x + b.x) / 2, Math.max(a.y, b.y) + 1.6, (a.z + b.z) / 2 + 0.8);
        arc(c.reel.position, a, ctrl, b, f);
        c.reel.quaternion.copy(qa).slerp(qb, f).multiply(qSpin);
      } else {
        c.reel.position.copy(a);
        c.reel.quaternion.copy(qa).multiply(qSpin);
      }
    });
    (benchShadow.material as THREE.MeshBasicMaterial).opacity = benchOut;
    (stackShadow.material as THREE.MeshBasicMaterial).opacity = 0.9;

    // the projector: lamp, film, the take-up reel turning
    const flick = !o.calm && st.lamp > 0.01 && st.lamp < 0.995 && Math.random() < 0.3 ? 0.3 : 1;
    const lamp = st.lamp * flick;
    projector.setLamp(lamp);
    projector.setThread(st.thread);
    projector.takeup.rotation.z -= dt * 2.4 * st.run;

    // the lens on the canvas, and which way it points, for the light to leave by
    const toCanvas = (ob: THREE.Object3D) => {
      ob.getWorldPosition(lensPx);
      lensPx.project(camera);
      return { x: view.band.x + ((lensPx.x + 1) / 2) * view.band.w, y: view.band.y + ((lensPx.y + 1) / 2) * view.band.h };
    };
    const lens = toCanvas(projector.lens);
    const aim = toCanvas(projector.aim);
    beam.update({
      w: view.w,
      h: view.h,
      lens,
      axis: Math.atan2(aim.y - lens.y, aim.x - lens.x),
      rect: view.rect,
      on: lamp,
      // with reduced motion the dust hangs still and the light holds steady
      time: o.calm ? 0 : time,
      dpr: renderer.getPixelRatio(),
      color: beamColor,
    });

    // light first, then the table over it, then the glow on the glass
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, view.w, view.h);
    renderer.clear();
    if (lamp > 0.002) renderer.render(beam.back, beam.camera);
    const { x, y, w, h } = view.band;
    renderer.setScissorTest(true);
    renderer.setScissor(x, y, w, h);
    renderer.setViewport(x, y, w, h);
    renderer.clearDepth();
    renderer.render(scene, camera);
    renderer.setScissorTest(false);
    if (lamp > 0.002) {
      renderer.setViewport(0, 0, view.w, view.h);
      renderer.render(beam.front, beam.camera);
    }
  });

  return {
    load,
    eject,
    dispose: () => {
      unsubscribe();
      io.disconnect();
      ro.disconnect();
      master?.kill();
      o.canvas.removeEventListener('pointermove', onMove);
      o.canvas.removeEventListener('pointerleave', onLeave);
      o.canvas.removeEventListener('pointerdown', onDown);
      o.canvas.removeEventListener('pointerup', onUp);
      cursor(null);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    },
  };
}
