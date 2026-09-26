'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { VERT, FRAG, FRAG_CAGE, PORTRAIT_VERT, PORTRAIT_FRAG } from '@/lib/shaders';
import { subscribe, pointer, view, accent, lerp, clamp01, smooth } from '@/lib/motion';

/* Blob choreography across the page (0 = top, 1 = bottom).
   x/y are NORMALISED to the visible frustum at the blob's depth: 1 = the screen
   edge, 0 = dead centre. World units would look right on one aspect ratio only ,
   on a portrait phone the visible half-width collapses to ~0.9 world units,
   which would throw the object clean off-screen for most of the page. */
const KEYS = [
  { at: 0.0, x: 0.54, y: 0.26, z: 0.0, s: 0.94, amp: 0.3, freq: 1.5, c: '#D8FF3E' },
  { at: 0.16, x: -0.45, y: 0.12, z: -1.6, s: 0.72, amp: 0.55, freq: 2.3, c: '#FF4D1C' },
  { at: 0.4, x: 0.5, y: -0.07, z: -1.2, s: 0.6, amp: 0.2, freq: 3.2, c: '#D8FF3E' },
  { at: 0.62, x: -0.53, y: 0.05, z: -1.9, s: 0.68, amp: 0.44, freq: 1.9, c: '#4CC9FF' },
  // drift up behind the closing headline so the email CTA below stays legible
  { at: 0.84, x: 0.0, y: 0.16, z: 0.4, s: 1.2, amp: 0.34, freq: 1.6, c: '#D8FF3E' },
  { at: 1.0, x: 0.0, y: 0.26, z: 1.1, s: 1.45, amp: 0.52, freq: 1.3, c: '#FF4D1C' },
];

const DEG2RAD = Math.PI / 180;

/* Hero portrait: width over height of the image, and where the top of his hair
   and the bottom of his beard sit, as fractions of the image height from the top. */
const PORTRAIT_ASPECT = 1334 / 2000;
const PORTRAIT_HAIR = 0.15;
const PORTRAIT_CHIN = 0.334;
// depth of the portrait plane, a little in front of the object's hero position
const PORTRAIT_Z = 0.8;

/* These hex values are artistic constants feeding custom shader maths, not
 * physical colours. Three's default sRGB->linear conversion on Color would
 * crush them (#3A1E6E loses ~75% of its value) and render the object almost
 * black. Declaring them as already-linear keeps the shader arithmetic, and so
 * the look, identical to the pre-migration build, while output still encodes
 * to sRGB correctly. */
const raw = (hex: string) => new THREE.Color().setStyle(hex, THREE.LinearSRGBColorSpace);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // phones pay for the displacement shader per-vertex, so scale the mesh
    // density and pixel ratio down rather than shipping the desktop budget
    const SMALL = Math.min(window.innerWidth, window.innerHeight) < 700;
    const DETAIL = SMALL ? 14 : window.innerWidth < 1400 ? 22 : 28;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !SMALL,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, SMALL ? 1.75 : 2));
    renderer.setClearAlpha(0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    );
    camera.position.z = 5;

    const uniforms = {
      uTime: { value: 0 },
      uAmp: { value: 0.3 },
      uFreq: { value: 1.5 },
      uMouse: { value: new THREE.Vector2() },
      uColorA: { value: raw('#3A1E6E') },
      uColorB: { value: raw('#08070a') },
      uColorC: { value: raw('#D8FF3E') },
      uOpacity: { value: 1 },
    };
    const cageUniforms = {
      uTime: uniforms.uTime,
      uAmp: { value: 0.22 },
      uFreq: { value: 1.1 },
      uMouse: uniforms.uMouse,
      uColorC: uniforms.uColorC,
      uOpacity: { value: 1 },
    };

    const group = new THREE.Group();
    scene.add(group);

    const blobGeo = new THREE.IcosahedronGeometry(1, DETAIL);
    const blobMat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
    });
    group.add(new THREE.Mesh(blobGeo, blobMat));

    const cageGeo = new THREE.IcosahedronGeometry(1.45, 6);
    const cageMat = new THREE.ShaderMaterial({
      uniforms: cageUniforms,
      vertexShader: VERT,
      fragmentShader: FRAG_CAGE,
      transparent: true,
      wireframe: true,
      depthWrite: false,
    });
    group.add(new THREE.Mesh(cageGeo, cageMat));

    // particle shell, outer radius stays well inside the camera distance so no
    // sprite drifts close enough to blow up into a big square
    const N = SMALL ? 700 : 1500;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
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
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    scene.add(dust);

    // The hero portrait is a real photograph placed in the scene itself rather than
    // layered over it, so the camera sway gives true parallax against the object,
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
        uColorC: uniforms.uColorC,
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
    dust.renderOrder = 2;

    // He is sized so his face fits between the hero's top rule and its headline:
    // hair just under the rule, chin just above the type. The headline then runs
    // across his (black) tee, cover style, and never over his face. Summed from
    // offsetTop, not read off rects, because the intro animates these with
    // transforms that would skew a rect read at mount.
    const brow = document.querySelector<HTMLElement>('.hero__eyebrow');
    const title = document.querySelector<HTMLElement>('.hero__title');
    const docTop = (el: HTMLElement) => {
      let y = 0;
      for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) y += n.offsetTop;
      return y;
    };
    let browTop = 0;
    let titleTop = 0;

    // Entrance: once the loader lifts he is lit only by the object's glow for a
    // beat, then the key light comes up.
    const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let litAt = -1;

    // Size off an observer rather than trusting innerWidth at mount: if the
    // canvas mounts before layout settles the viewport can report 0, and a
    // resize event alone may never arrive to correct it.
    const resize = () => {
      if (brow && title) {
        browTop = docTop(brow);
        titleTop = docTop(title);
      }
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(document.documentElement);
    window.addEventListener('resize', resize);

    const cA = new THREE.Color();
    const cB = new THREE.Color();
    const cTarget = new THREE.Color();

    const unsubscribe = subscribe((t) => {
      const p = view.scrollP;

      let i = 0;
      while (i < KEYS.length - 2 && p > KEYS[i + 1].at) i++;
      const a = KEYS[i];
      const b = KEYS[i + 1];
      const k = smooth(clamp01((p - a.at) / (b.at - a.at)));

      const px = lerp(a.x, b.x, k);
      const py = lerp(a.y, b.y, k);
      const pz = lerp(a.z, b.z, k);
      let ps = lerp(a.s, b.s, k);

      // half-extents of the camera frustum at the blob's current depth
      const halfH = Math.tan((camera.fov / 2) * DEG2RAD) * (camera.position.z - pz);
      const halfW = halfH * camera.aspect;

      // On portrait screens there is no horizontal room to park the object in,
      // so trade lateral travel for vertical and pull the scale back a little.
      const portrait = camera.aspect < 1;
      const kx = portrait ? 0.55 : 1;
      const ky = portrait ? 2.6 : 1;
      if (portrait) ps *= 0.78;

      const tx = px * halfW * kx + pointer.x * halfW * 0.06;
      const ty = py * halfH * ky - pointer.y * halfH * 0.06;

      group.position.x = lerp(group.position.x, tx, 0.08);
      group.position.y = lerp(group.position.y, ty, 0.08);
      group.position.z = lerp(group.position.z, pz, 0.08);
      group.scale.setScalar(lerp(group.scale.x, ps, 0.08));

      group.rotation.y = p * Math.PI * 2.4 + t * 0.06;
      group.rotation.x = Math.sin(p * Math.PI * 2) * 0.35 + pointer.y * 0.12;

      uniforms.uTime.value = t;
      uniforms.uAmp.value = lerp(uniforms.uAmp.value, lerp(a.amp, b.amp, k), 0.05);
      uniforms.uFreq.value = lerp(uniforms.uFreq.value, lerp(a.freq, b.freq, k), 0.05);
      uniforms.uMouse.value.set(pointer.x, pointer.y);
      cageUniforms.uAmp.value = uniforms.uAmp.value * 0.7;

      // A hovered work row overrides the scroll track's colour. Easing toward a
      // target rather than assigning it outright means both directions cross-fade.
      if (accent.hex) {
        cTarget.setStyle(accent.hex, THREE.LinearSRGBColorSpace);
      } else {
        cA.setStyle(a.c, THREE.LinearSRGBColorSpace);
        cB.setStyle(b.c, THREE.LinearSRGBColorSpace);
        cTarget.copy(cA).lerp(cB, k);
      }
      uniforms.uColorC.value.lerp(cTarget, 0.09);

      // Portrait, measured in world units at its own depth. It trails the page by a
      // tenth on scroll so the type in front reads as the nearer layer.
      const pHalfH = Math.tan((camera.fov / 2) * DEG2RAD) * (camera.position.z - PORTRAIT_Z);
      const pHalfW = pHalfH * camera.aspect;
      const toWorld = (2 * pHalfH) / window.innerHeight;
      const gap = 0.02 * window.innerHeight;
      const fitH = ((titleTop - browTop - 2 * gap) * toWorld) / (PORTRAIT_CHIN - PORTRAIT_HAIR);
      const pH = Math.min(fitH, 0.94 * 2 * pHalfH, (0.9 * 2 * pHalfW) / PORTRAIT_ASPECT);
      const chinY = pHalfH - (titleTop - gap - window.scrollY * 0.9) * toWorld;
      const pY = chinY + (PORTRAIT_CHIN - 0.5) * pH;
      portraitMesh.scale.set(pH * PORTRAIT_ASPECT, pH, 1);
      // left of centre on landscape screens so he looks across at the object
      portraitMesh.position.set((portrait ? 0 : -0.28) * pHalfW, pY, PORTRAIT_Z);
      // hidden once scrolled away, and on hero layouts too squat to fit him properly
      portraitMesh.visible =
        portraitReady && !!title && pH > 0.3 * 2 * pHalfH && pY - pH / 2 < pHalfH;

      if (litAt < 0 && !document.body.classList.contains('is-loading')) litAt = t;
      const lit = calmMotion ? 1 : litAt < 0 ? 0 : smooth(clamp01((t - litAt - 0.5) / 1.4));
      portraitMat.uniforms.uKey.value = 0.06 + 0.94 * lit;

      dust.rotation.y = -t * 0.03 + p * 1.2;
      dust.rotation.x = p * 0.6;

      camera.position.x = lerp(camera.position.x, pointer.x * 0.35, 0.05);
      camera.position.y = lerp(camera.position.y, -pointer.y * 0.28, 0.05);
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    });

    return () => {
      unsubscribe();
      ro.disconnect();
      window.removeEventListener('resize', resize);
      blobGeo.dispose();
      blobMat.dispose();
      cageGeo.dispose();
      cageMat.dispose();
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

  return <canvas id="gl" ref={canvasRef} />;
}
