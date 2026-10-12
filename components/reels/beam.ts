import * as THREE from 'three';

/* The projector's light, drawn flat over the whole stage in canvas pixels: a
 * fan from the lens to the edges of the screen (which is a DOM element sitting
 * over the canvas, so the beam disappears under it exactly where it lands),
 * dust turning in it, and a glow on the lens. Because it is 2D it follows the
 * screen wherever the layout puts it, with no camera to keep in step. */

type Track = <T extends { dispose: () => void }>(x: T) => T;

export type BeamFrame = {
  /** canvas size, CSS px */
  w: number;
  h: number;
  /** the lens, in canvas px from the bottom left */
  lens: { x: number; y: number };
  /** which way the lens points on the canvas, radians */
  axis: number;
  /** the screen, in canvas px from the bottom left */
  rect: { left: number; bottom: number; right: number; top: number };
  /** 0 dark .. 1 lamp fully up */
  on: number;
  time: number;
  dpr: number;
  color: THREE.Color;
};

const FAN_VERT = /* glsl */ `
  varying vec2 vPx;
  void main() {
    vPx = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FAN_FRAG = /* glsl */ `
  uniform vec2 uL;
  uniform float uA0;
  uniform float uA1;
  uniform float uLen;
  uniform float uAxis;
  uniform float uOn;
  uniform float uTime;
  uniform vec3 uColor;
  varying vec2 vPx;
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  float noise(float x) {
    float i = floor(x);
    float f = fract(x);
    return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f));
  }
  void main() {
    vec2 d = vPx - uL;
    float r = length(d);
    float a = atan(d.y, d.x);
    // where across the beam: 0 at one edge, 1 at the other
    float u = clamp((a - uA0) / max(uA1 - uA0, 1e-3), 0.0, 1.0);
    float edge = smoothstep(0.0, 0.1, u) * smoothstep(1.0, 0.9, u);
    // brightest straight out of the lens, so the light follows the way it points
    float off = (a - uAxis) / 0.62;
    float hot = mix(0.3, 1.0, exp(-off * off));
    // the streaks a real beam shows through haze, drifting slowly
    float rays = 0.72 + 0.28 * noise(u * 46.0 + uTime * 0.35) * noise(u * 13.0 - uTime * 0.2 + 7.0);
    // bright and narrow at the lens, thinning as it spreads
    float fall = mix(1.0, 0.28, clamp(r / uLen, 0.0, 1.0));
    float near = smoothstep(4.0, 46.0, r);
    // the shutter: 24 frames a second, felt more than seen
    float flick = 0.94 + 0.06 * noise(uTime * 24.0);
    float alpha = uOn * edge * hot * rays * fall * near * flick * 0.3;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

const DUST_VERT = /* glsl */ `
  attribute vec3 aSeed;
  uniform vec2 uL;
  uniform float uA0;
  uniform float uA1;
  uniform vec4 uRect;
  uniform float uOn;
  uniform float uTime;
  uniform float uSize;
  varying float vAlpha;
  void main() {
    float u = clamp(aSeed.x + 0.02 * sin(uTime * 0.07 + aSeed.z * 40.0), 0.05, 0.95);
    float th = mix(uA0, uA1, u);
    vec2 n = vec2(cos(th), sin(th));
    // how far this ray runs before it reaches the screen
    float reach = (uRect.y - uL.y) / max(n.y, 0.05);
    float hx = uL.x + n.x * reach;
    if (hx < uRect.x && n.x > 0.0) reach = (uRect.x - uL.x) / n.x;
    else if (hx > uRect.z && n.x < 0.0) reach = (uRect.z - uL.x) / n.x;
    // drifting slowly out along the light, and turning over as it goes
    float v = fract(aSeed.y + uTime * (0.006 + aSeed.z * 0.01));
    vec2 p = uL + n * reach * mix(0.1, 0.97, v);
    p += vec2(sin(uTime * 0.31 + aSeed.z * 20.0), cos(uTime * 0.23 + aSeed.y * 20.0)) * 5.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
    float tw = 0.5 + 0.5 * sin(uTime * (1.2 + aSeed.z * 3.0) + aSeed.x * 50.0);
    vAlpha = uOn * (0.25 + 0.75 * tw) * smoothstep(0.0, 0.12, v) * smoothstep(1.0, 0.86, v) * (0.35 + 0.65 * aSeed.z);
    gl_PointSize = uSize * (0.5 + aSeed.z * 1.5);
  }
`;

const DUST_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float a = texture2D(uMap, gl_PointCoord).a;
    gl_FragColor = vec4(uColor, a * vAlpha * 0.7);
  }
`;

/** Convex hull of a few points, counter-clockwise (Andrew's monotone chain). */
function hull(pts: { x: number; y: number; i: number }[]) {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: (typeof p)[0], a: (typeof p)[0], b: (typeof p)[0]) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: typeof p = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: typeof p = [];
  for (let k = p.length - 1; k >= 0; k--) {
    const q = p[k];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

export function buildBeam(track: Track, glow: THREE.Texture) {
  const back = new THREE.Scene();
  const front = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);

  // the fan: the lens and up to four corners of the screen
  const fanGeo = track(new THREE.BufferGeometry());
  const fanPos = new Float32Array(5 * 3);
  fanGeo.setAttribute('position', new THREE.BufferAttribute(fanPos, 3));
  fanGeo.setIndex(new THREE.BufferAttribute(new Uint16Array(9), 1));
  const fanUni = {
    uL: { value: new THREE.Vector2() },
    uA0: { value: 0 },
    uA1: { value: 1 },
    uLen: { value: 1 },
    uAxis: { value: Math.PI / 2 },
    uOn: { value: 0 },
    uTime: { value: 0 },
    uColor: { value: new THREE.Color() },
  };
  const fan = new THREE.Mesh(
    fanGeo,
    track(
      new THREE.ShaderMaterial({
        uniforms: fanUni,
        vertexShader: FAN_VERT,
        fragmentShader: FAN_FRAG,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );
  fan.frustumCulled = false;
  back.add(fan);

  // dust in the light
  const N = 180;
  const seeds = new Float32Array(N * 3);
  for (let i = 0; i < N * 3; i++) seeds[i] = Math.random();
  const dustGeo = track(new THREE.BufferGeometry());
  dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  const dustUni = {
    uL: fanUni.uL,
    uA0: fanUni.uA0,
    uA1: fanUni.uA1,
    uRect: { value: new THREE.Vector4() },
    uOn: fanUni.uOn,
    uTime: fanUni.uTime,
    uSize: { value: 3 },
    uMap: { value: glow },
    uColor: fanUni.uColor,
  };
  const dust = new THREE.Points(
    dustGeo,
    track(
      new THREE.ShaderMaterial({
        uniforms: dustUni,
        vertexShader: DUST_VERT,
        fragmentShader: DUST_FRAG,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );
  dust.frustumCulled = false;
  back.add(dust);

  // the lens itself, glowing: drawn after the projector, so it sits on the glass
  const glowMat = (opacity: number) =>
    track(new THREE.SpriteMaterial({ map: glow, color: '#fff1d6', blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, opacity }));
  const halo = new THREE.Sprite(glowMat(0.55));
  const core = new THREE.Sprite(glowMat(1));
  front.add(halo, core);

  const update = (f: BeamFrame) => {
    camera.right = f.w;
    camera.top = f.h;
    camera.updateProjectionMatrix();
    const { lens: L, rect: R } = f;
    const pts = [
      { x: L.x, y: L.y, i: 0 },
      { x: R.left, y: R.bottom, i: 1 },
      { x: R.right, y: R.bottom, i: 2 },
      { x: R.right, y: R.top, i: 3 },
      { x: R.left, y: R.top, i: 4 },
    ];
    pts.forEach((q, k) => {
      fanPos[k * 3] = q.x;
      fanPos[k * 3 + 1] = q.y;
    });
    fanGeo.attributes.position.needsUpdate = true;
    const h = hull(pts);
    const at = h.findIndex((q) => q.i === 0);
    const idx = fanGeo.index!.array as Uint16Array;
    idx.fill(0);
    let n = 0;
    if (at >= 0) {
      // a fan from the lens round the rest of the hull
      for (let k = 1; k < h.length - 1; k++) {
        idx[n++] = 0;
        idx[n++] = h[(at + k) % h.length].i;
        idx[n++] = h[(at + k + 1) % h.length].i;
      }
      // the two rays that bound the beam are the lens's neighbours on the hull
      const a = h[(at + 1) % h.length];
      const b = h[(at + h.length - 1) % h.length];
      const aa = Math.atan2(a.y - L.y, a.x - L.x);
      const ab = Math.atan2(b.y - L.y, b.x - L.x);
      fanUni.uA0.value = Math.min(aa, ab);
      fanUni.uA1.value = Math.max(aa, ab);
    }
    fanGeo.setDrawRange(0, n);
    fanGeo.index!.needsUpdate = true;

    fanUni.uL.value.set(L.x, L.y);
    fanUni.uLen.value = Math.hypot((R.left + R.right) / 2 - L.x, (R.bottom + R.top) / 2 - L.y);
    fanUni.uAxis.value = f.axis;
    fanUni.uOn.value = f.on;
    fanUni.uTime.value = f.time;
    fanUni.uColor.value.copy(f.color);
    dustUni.uRect.value.set(R.left, R.bottom, R.right, R.top);
    dustUni.uSize.value = 3.2 * f.dpr;

    halo.position.set(L.x, L.y, 0);
    core.position.set(L.x, L.y, 0);
    const s = f.on * (0.9 + 0.1 * Math.sin(f.time * 31));
    halo.scale.setScalar(150 * s + 0.001);
    core.scale.setScalar(34 * s + 0.001);
    fan.visible = dust.visible = halo.visible = core.visible = f.on > 0.002;
  };

  return { back, front, camera, update };
}
