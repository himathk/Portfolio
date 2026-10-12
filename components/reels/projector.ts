import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { plateTexture, threadTexture, ventTexture } from './textures';

/* A 16mm projector in the old shape: a low body, the lamp house at the back,
 * the lens at the front, and two arms carrying the reels above it. The film
 * threads down the near side, past the gate behind the lens and back up to the
 * take-up reel. Local axes: the lens points along +x, the reels face +z.
 */

type Track = <T extends { dispose: () => void }>(x: T) => T;

/** Reel size, shared with the reels that ride in the cans. */
export const REEL_R = 0.95;
export const REEL_T = 0.14;

/** A reel: two punched flanges with the film wound between them. */
export function buildReel(track: Track, face: THREE.Texture, pack: number) {
  const g = new THREE.Group();
  const faceMat = track(
    new THREE.MeshStandardMaterial({ map: face, metalness: 0.35, roughness: 0.42, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
  );
  const faceGeo = track(new THREE.CircleGeometry(REEL_R, 64));
  const front = new THREE.Mesh(faceGeo, faceMat);
  front.position.z = REEL_T / 2;
  const back = new THREE.Mesh(faceGeo, faceMat);
  back.position.z = -REEL_T / 2;
  back.rotation.y = Math.PI;
  // the edge of the wound film, seen between the flanges
  const packMesh = new THREE.Mesh(
    track(new THREE.CylinderGeometry(REEL_R * pack, REEL_R * pack, REEL_T * 0.92, 48, 1, true)),
    track(new THREE.MeshStandardMaterial({ color: '#2a1d12', roughness: 0.55, metalness: 0.1 })),
  );
  packMesh.rotation.x = Math.PI / 2;
  const hub = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.12, 0.12, REEL_T + 0.04, 20)),
    track(new THREE.MeshStandardMaterial({ color: '#cfd2d8', metalness: 1, roughness: 0.3 })),
  );
  hub.rotation.x = Math.PI / 2;
  g.add(front, back, packMesh, hub);
  return g;
}

/** A thin ribbon along a path, its width across z: film running edge-on along
 *  the side of the machine. */
function threadGeometry(curve: THREE.Curve<THREE.Vector3>, width: number, segments: number) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const p = new THREE.Vector3();
  const len = curve.getLength();
  for (let i = 0; i <= segments; i++) {
    const s = i / segments;
    curve.getPointAt(s, p);
    pos.push(p.x, p.y, p.z + width / 2, p.x, p.y, p.z - width / 2);
    uv.push((s * len) / 0.5, 1, (s * len) / 0.5, 0);
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

export type Projector = {
  group: THREE.Group;
  /** where the feed reel sits, and turns */
  mount: THREE.Object3D;
  /** the empty reel at the back, which turns while it runs */
  takeup: THREE.Group;
  /** the front of the lens, where the light leaves */
  lens: THREE.Object3D;
  /** a little way out along the lens's axis, to aim the light by */
  aim: THREE.Object3D;
  /** everything a pointer can land on */
  hit: THREE.Object3D[];
  setLamp: (v: number) => void;
  setThread: (v: number) => void;
};

/** How far the front is raised on its elevation leg, so the lens looks up at
 *  the screen above the table rather than across it. */
const TILT = 0.17;

export function buildProjector(track: Track, takeupFace: THREE.Texture): Projector {
  const group = new THREE.Group();
  // the machine tips up about its back feet
  const pivot = new THREE.Group();
  pivot.position.set(-1.2, 0, 0);
  pivot.rotation.z = TILT;
  group.add(pivot);
  const body = new THREE.Group();
  body.position.set(1.2, 0, 0);
  pivot.add(body);

  const paint = track(new THREE.MeshStandardMaterial({ color: '#2d2e35', metalness: 0.55, roughness: 0.4 }));
  const trim = track(new THREE.MeshStandardMaterial({ color: '#b9bdc6', metalness: 1, roughness: 0.26 }));
  const dark = track(new THREE.MeshStandardMaterial({ color: '#131317', metalness: 0.35, roughness: 0.55 }));
  const vents = track(
    new THREE.MeshStandardMaterial({
      color: '#2d2e35',
      metalness: 0.5,
      roughness: 0.45,
      emissive: new THREE.Color('#ffc97c'),
      emissiveMap: track(ventTexture().tex),
      emissiveIntensity: 0,
    }),
  );
  const glass = track(
    new THREE.MeshStandardMaterial({ color: '#0c0c10', metalness: 0.2, roughness: 0.06, emissive: new THREE.Color('#fff2d8'), emissiveIntensity: 0 }),
  );
  const lime = track(new THREE.MeshStandardMaterial({ color: '#D8FF3E', emissive: new THREE.Color('#D8FF3E'), emissiveIntensity: 0.4, roughness: 0.4 }));
  const plate = track(new THREE.MeshStandardMaterial({ map: track(plateTexture().tex), metalness: 0.6, roughness: 0.35 }));

  const add = (geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], x: number, y: number, z: number) => {
    const m = new THREE.Mesh(track(geo), mat);
    m.position.set(x, y, z);
    body.add(m);
    return m;
  };

  // body, deck and feet
  add(new RoundedBoxGeometry(3.0, 1.0, 1.05, 4, 0.12), paint, 0, 0.62, 0);
  add(new RoundedBoxGeometry(2.6, 0.05, 0.92, 2, 0.02), trim, 0.1, 1.135, 0);
  for (const z of [0.36, -0.36]) add(new THREE.CylinderGeometry(0.07, 0.09, 0.12, 16), dark, -1.2, 0.06, z);
  // the elevation leg under the nose, down to the table
  const reach = 2.4 * Math.tan(TILT);
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.12 + reach, 12), trim, 1.2, 0.06 - reach / 2, 0);
  add(new THREE.CylinderGeometry(0.11, 0.13, 0.06, 20), dark, 1.2, 0.03 - reach, 0);

  // the lamp house at the back, vents on both sides
  add(new RoundedBoxGeometry(0.8, 0.92, 0.92, 4, 0.14), [paint, paint, paint, paint, vents, vents], -1.82, 0.62, 0);
  add(new RoundedBoxGeometry(0.42, 0.16, 0.52, 2, 0.05), trim, -1.82, 1.13, 0);

  // the lens: a fat barrel, a slimmer front, a bright ring and the glass
  const barrel = add(new THREE.CylinderGeometry(0.27, 0.29, 0.5, 40), trim, 1.75, 0.66, 0);
  barrel.rotation.z = -Math.PI / 2;
  const front = add(new THREE.CylinderGeometry(0.21, 0.25, 0.3, 40), dark, 2.15, 0.66, 0);
  front.rotation.z = -Math.PI / 2;
  const ring = add(new THREE.TorusGeometry(0.205, 0.025, 10, 40), trim, 2.3, 0.66, 0);
  ring.rotation.y = Math.PI / 2;
  const lensGlass = add(new THREE.CircleGeometry(0.185, 40), glass, 2.305, 0.66, 0);
  lensGlass.rotation.y = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 16), trim, 1.8, 0.98, 0);
  const lens = new THREE.Object3D();
  lens.position.set(2.32, 0.66, 0);
  const aim = new THREE.Object3D();
  aim.position.set(3.32, 0.66, 0);
  body.add(lens, aim);

  // the near side: gate panel, sprockets, sound drum, badge and power knob
  add(new RoundedBoxGeometry(0.8, 0.7, 0.06, 2, 0.03), dark, 1.0, 0.62, 0.54);
  for (const [x, y, r] of [
    [0.55, 0.95, 0.15],
    [0.1, 0.34, 0.15],
    [-0.55, 0.45, 0.2],
  ]) {
    const s = add(new THREE.CylinderGeometry(r, r, 0.07, 28), trim, x, y, 0.56);
    s.rotation.x = Math.PI / 2;
  }
  const badge = add(new THREE.PlaneGeometry(0.78, 0.245), plate, -0.95, 0.8, 0.528);
  badge.renderOrder = 1;
  const knob = add(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 24), dark, -1.15, 0.36, 0.56);
  knob.rotation.x = Math.PI / 2;
  add(new THREE.TorusGeometry(0.12, 0.016, 8, 32), lime, -1.15, 0.36, 0.6);

  // the arms, leaning out fore and aft, with a hub on top of each
  const arm = (x0: number, x1: number) => {
    const y0 = 1.14;
    const y1 = 2.42;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const a = add(new THREE.BoxGeometry(0.1, len, 0.1), paint, (x0 + x1) / 2, (y0 + y1) / 2, 0.32);
    a.rotation.z = -Math.atan2(x1 - x0, y1 - y0);
    const hub = add(new THREE.CylinderGeometry(0.075, 0.075, 0.32, 16), trim, x1, y1, 0.47);
    hub.rotation.x = Math.PI / 2;
  };
  arm(0.55, 0.92);
  arm(-0.95, -1.32);

  const mount = new THREE.Object3D();
  mount.position.set(0.92, 2.42, 0.62);
  body.add(mount);

  const takeup = buildReel(track, takeupFace, 0.36);
  takeup.position.set(-1.32, 2.42, 0.62);
  body.add(takeup);

  // the film's path: off the bottom of the feed reel, down past the gate behind
  // the lens, round the sound drum and up onto the take-up reel
  const path = new THREE.CatmullRomCurve3(
    [
      [0.8, 1.6],
      [0.66, 1.26],
      [0.55, 0.96],
      [0.98, 0.84],
      [1.32, 0.7],
      [1.08, 0.42],
      [0.55, 0.3],
      [0.1, 0.34],
      [-0.55, 0.47],
      [-0.98, 0.92],
      [-1.2, 1.55],
      [-1.28, 2.08],
    ].map(([x, y]) => new THREE.Vector3(x, y, 0.62)),
  );
  const SEG = 160;
  const threadMap = track(threadTexture().tex);
  threadMap.wrapS = THREE.RepeatWrapping;
  const thread = new THREE.Mesh(
    track(threadGeometry(path, 0.09, SEG)),
    track(new THREE.MeshStandardMaterial({ map: threadMap, roughness: 0.5, side: THREE.DoubleSide, transparent: true, alphaTest: 0.5 })),
  );
  thread.visible = false;
  body.add(thread);

  // the lamp's spill on the lens housing and whatever stands near it
  const spill = new THREE.PointLight('#ffd9a0', 0, 5, 2);
  spill.position.set(2.7, 0.8, 0.2);
  body.add(spill);

  const hit = body.children.filter((o) => o instanceof THREE.Mesh || o === takeup);

  return {
    group,
    mount,
    takeup,
    lens,
    aim,
    hit,
    setLamp: (v) => {
      glass.emissiveIntensity = v * 3.4;
      vents.emissiveIntensity = v * 1.6;
      spill.intensity = v * 5;
    },
    setThread: (v) => {
      thread.visible = v > 0.002;
      thread.geometry.setDrawRange(0, Math.floor(v * SEG) * 6);
    },
  };
}
