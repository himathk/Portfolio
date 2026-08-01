/* =========================================================
   HIMATH KARIYAWASAM — portfolio
   Three.js (r149 UMD) + GSAP/ScrollTrigger + Lenis
   ========================================================= */

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const HAS_GSAP = typeof gsap !== 'undefined';
const HAS_GL = typeof THREE !== 'undefined';

if (HAS_GSAP && typeof ScrollTrigger !== 'undefined') gsap.registerPlugin(ScrollTrigger);

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = v => Math.min(1, Math.max(0, v));
const smooth = t => t * t * (3 - 2 * t);

/* ---------------------------------------------------------
   TEXT SPLITTING (structure-preserving)
--------------------------------------------------------- */
function splitWords(root) {
  const out = [];
  (function walk(node) {
    [...node.childNodes].forEach(child => {
      if (child.nodeType === 3) {
        const parts = child.textContent.split(/(\s+)/).filter(Boolean);
        if (!parts.length) return;
        const frag = document.createDocumentFragment();
        parts.forEach(p => {
          if (/^\s+$/.test(p)) return frag.appendChild(document.createTextNode(p));
          const s = document.createElement('span');
          s.className = 'word';
          s.textContent = p;
          out.push(s);
          frag.appendChild(s);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1) walk(child);
    });
  })(root);
  return out;
}

function splitChars(el) {
  const text = el.textContent;
  el.textContent = '';
  return [...text].map(ch => {
    const outer = document.createElement('span');
    outer.className = 'line';
    outer.style.display = 'inline-block';
    const inner = document.createElement('span');
    inner.className = 'line__i';
    inner.textContent = /\s/.test(ch) ? ' ' : ch;
    outer.appendChild(inner);
    el.appendChild(outer);
    return inner;
  });
}

/* ---------------------------------------------------------
   SMOOTH SCROLL
--------------------------------------------------------- */
let lenis = null;
if (typeof Lenis !== 'undefined' && !REDUCED) {
  lenis = new Lenis({ duration: 1.15, smoothWheel: true, wheelMultiplier: 1 });
  if (HAS_GSAP) {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) { e.preventDefault(); lenis.scrollTo(target, { offset: 0 }); }
    });
  });
}

/* =========================================================
   WEBGL — displaced blob + cage + particle shell
   ========================================================= */
const NOISE_GLSL = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(
      i.z+vec4(0.0,i1.z,i2.z,1.0))
    + i.y+vec4(0.0,i1.y,i2.y,1.0))
    + i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const VERT = `
uniform float uTime;
uniform float uAmp;
uniform float uFreq;
uniform vec2  uMouse;
varying vec3  vNormal;
varying vec3  vView;
varying float vDisp;
${NOISE_GLSL}
float fbm(vec3 p){
  float f=0.0, a=0.5;
  for(int i=0;i<3;i++){ f+=a*snoise(p); p*=2.03; a*=0.5; }
  return f;
}
float disp(vec3 dir){
  float n = fbm(dir*uFreq + vec3(0.0,0.0,uTime*0.22));
  float m = smoothstep(0.9, 0.0, distance(dir.xy, uMouse*1.2));
  return n + m*0.5;
}
vec3 surf(vec3 dir){ return dir*(1.0 + disp(dir)*uAmp); }
void main(){
  vec3 dir = normalize(position);
  vec3 P   = surf(dir);
  vec3 ref = abs(dir.y) < 0.99 ? vec3(0.0,1.0,0.0) : vec3(1.0,0.0,0.0);
  vec3 t1  = normalize(cross(dir, ref));
  vec3 t2  = normalize(cross(dir, t1));
  float e  = 0.035;
  vec3 Pa  = surf(normalize(dir + t1*e));
  vec3 Pb  = surf(normalize(dir + t2*e));
  vec3 n   = normalize(cross(Pa - P, Pb - P));
  if(dot(n, dir) < 0.0) n = -n;
  vDisp   = disp(dir);
  vNormal = normalize(normalMatrix * n);
  vec4 mv = modelViewMatrix * vec4(P, 1.0);
  vView   = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = `
uniform vec3  uColorA;
uniform vec3  uColorB;
uniform vec3  uColorC;
uniform float uOpacity;
varying vec3  vNormal;
varying vec3  vView;
varying float vDisp;
void main(){
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vView);
  float fres = pow(1.0 - clamp(dot(N,V),0.0,1.0), 2.6);
  vec3  base = mix(uColorA, uColorB, smoothstep(-0.9, 0.9, vDisp));
  float key  = clamp(dot(N, normalize(vec3(0.45,0.8,0.55))), 0.0, 1.0);
  vec3  col  = base * (0.30 + key*0.9);
  col += uColorC * smoothstep(0.30, 1.0, fres) * 1.35;
  col += pow(key, 22.0) * 0.55;
  gl_FragColor = vec4(col, uOpacity);
}`;

const FRAG_CAGE = `
uniform vec3  uColorC;
uniform float uOpacity;
varying vec3  vNormal;
varying vec3  vView;
varying float vDisp;
void main(){
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vView);
  float fres = pow(1.0 - clamp(dot(N,V),0.0,1.0), 2.0);
  gl_FragColor = vec4(uColorC, uOpacity * (0.10 + fres*0.55));
}`;

/* Blob choreography across the page (0 = top, 1 = bottom).
   x/y are NORMALISED to the visible frustum at the blob's depth: 1 = the screen
   edge, 0 = dead centre. World units would look right on one aspect ratio only —
   on a portrait phone the visible half-width collapses to ~0.9 world units, which
   is what threw the object clean off-screen for most of the page. */
const KEYS = [
  { at: 0.00, x:  0.54, y:  0.26, z:  0.0, s: 0.94, amp: 0.30, freq: 1.5, c: '#D8FF3E' },
  { at: 0.16, x: -0.45, y:  0.12, z: -1.6, s: 0.72, amp: 0.55, freq: 2.3, c: '#FF4D1C' },
  { at: 0.40, x:  0.50, y: -0.07, z: -1.2, s: 0.60, amp: 0.20, freq: 3.2, c: '#D8FF3E' },
  { at: 0.62, x: -0.53, y:  0.05, z: -1.9, s: 0.68, amp: 0.44, freq: 1.9, c: '#4CC9FF' },
  // drift up behind the closing headline so the email CTA below stays legible
  { at: 0.84, x:  0.00, y:  0.16, z:  0.4, s: 1.20, amp: 0.34, freq: 1.6, c: '#D8FF3E' },
  { at: 1.00, x:  0.00, y:  0.26, z:  1.1, s: 1.45, amp: 0.52, freq: 1.3, c: '#FF4D1C' },
];

const DEG2RAD = Math.PI / 180;

const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
let scrollP = 0;
let gl = null;

function initGL() {
  const canvas = document.getElementById('gl');
  if (!HAS_GL) { canvas.style.background = 'radial-gradient(60% 50% at 65% 40%, #2a1b4d 0%, #08070a 70%)'; return; }

  // phones pay for the displacement shader per-vertex, so scale the mesh density
  // and the pixel ratio down rather than shipping the desktop budget to a handset
  const SMALL = Math.min(innerWidth, innerHeight) < 700;
  const DETAIL = SMALL ? 14 : (innerWidth < 1400 ? 22 : 28);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !SMALL, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, SMALL ? 1.75 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearAlpha(0);
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
  camera.position.z = 5;

  const uniforms = {
    uTime:    { value: 0 },
    uAmp:     { value: 0.30 },
    uFreq:    { value: 1.5 },
    uMouse:   { value: new THREE.Vector2() },
    uColorA:  { value: new THREE.Color('#3A1E6E') },
    uColorB:  { value: new THREE.Color('#08070a') },
    uColorC:  { value: new THREE.Color('#D8FF3E') },
    uOpacity: { value: 1 },
  };
  const cageUniforms = {
    uTime:    uniforms.uTime,
    uAmp:     { value: 0.22 },
    uFreq:    { value: 1.1 },
    uMouse:   uniforms.uMouse,
    uColorC:  uniforms.uColorC,
    uOpacity: { value: 1 },
  };

  const group = new THREE.Group();
  scene.add(group);

  const blob = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, DETAIL),
    new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true })
  );
  group.add(blob);

  const cage = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.45, 6),
    new THREE.ShaderMaterial({
      uniforms: cageUniforms, vertexShader: VERT, fragmentShader: FRAG_CAGE,
      transparent: true, wireframe: true, depthWrite: false,
    })
  );
  group.add(cage);

  // particle shell. Outer radius stays well inside the camera distance (z=5) so no
  // sprite ever drifts close enough to blow up into a big square.
  const N = SMALL ? 700 : 1500;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 2.3 + Math.random() * 1.7;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3]     = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.7;
    pos[i * 3 + 2] = r * Math.cos(ph);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

  // soft round sprite — untextured points render as hard squares
  const dotCv = document.createElement('canvas');
  dotCv.width = dotCv.height = 64;
  const dctx = dotCv.getContext('2d');
  const grad = dctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  dctx.fillStyle = grad;
  dctx.fillRect(0, 0, 64, 64);

  const dust = new THREE.Points(pGeo, new THREE.PointsMaterial({
    color: 0xD8FF3E, size: 0.03, sizeAttenuation: true, map: new THREE.CanvasTexture(dotCv),
    transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  scene.add(dust);

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  const cA = new THREE.Color(), cB = new THREE.Color();

  gl = { renderer, scene, camera, group, dust, uniforms, cageUniforms,
    frame(t) {
      // interpolate the keyframe track
      let i = 0;
      while (i < KEYS.length - 2 && scrollP > KEYS[i + 1].at) i++;
      const a = KEYS[i], b = KEYS[i + 1];
      const k = smooth(clamp01((scrollP - a.at) / (b.at - a.at)));

      const px = lerp(a.x, b.x, k), py = lerp(a.y, b.y, k), pz = lerp(a.z, b.z, k);
      let   ps = lerp(a.s, b.s, k);

      // half-extents of the camera frustum at the blob's current depth
      const halfH = Math.tan(camera.fov / 2 * DEG2RAD) * (camera.position.z - pz);
      const halfW = halfH * camera.aspect;

      // On portrait screens there is no horizontal room to park the object in, so
      // trade lateral travel for vertical travel and pull the scale back a little.
      const portrait = camera.aspect < 1;
      const kx = portrait ? 0.55 : 1;
      const ky = portrait ? 2.60 : 1;
      if (portrait) ps *= 0.78;

      const tx = px * halfW * kx + mouse.x * halfW * 0.06;
      const ty = py * halfH * ky - mouse.y * halfH * 0.06;

      group.position.x = lerp(group.position.x, tx, 0.08);
      group.position.y = lerp(group.position.y, ty, 0.08);
      group.position.z = lerp(group.position.z, pz, 0.08);
      group.scale.setScalar(lerp(group.scale.x, ps, 0.08));

      group.rotation.y = scrollP * Math.PI * 2.4 + t * 0.06;
      group.rotation.x = Math.sin(scrollP * Math.PI * 2) * 0.35 + mouse.y * 0.12;

      uniforms.uTime.value = t;
      uniforms.uAmp.value  = lerp(uniforms.uAmp.value,  lerp(a.amp,  b.amp,  k), 0.05);
      uniforms.uFreq.value = lerp(uniforms.uFreq.value, lerp(a.freq, b.freq, k), 0.05);
      uniforms.uMouse.value.set(mouse.x, mouse.y);
      cageUniforms.uAmp.value = uniforms.uAmp.value * 0.7;

      cA.set(a.c); cB.set(b.c);
      uniforms.uColorC.value.copy(cA).lerp(cB, k);

      dust.rotation.y = -t * 0.03 + scrollP * 1.2;
      dust.rotation.x = scrollP * 0.6;

      camera.position.x = lerp(camera.position.x, mouse.x * 0.35, 0.05);
      camera.position.y = lerp(camera.position.y, -mouse.y * 0.28, 0.05);
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    }
  };
}

addEventListener('pointermove', e => {
  mouse.tx = (e.clientX / innerWidth) * 2 - 1;
  mouse.ty = (e.clientY / innerHeight) * 2 - 1;
});

/* =========================================================
   MAIN RAF — GL + cursor + preview + strip marquee
   ========================================================= */
const cursorEl = document.getElementById('cursor');
const previewEl = document.getElementById('preview');
const stripTrack = document.querySelector('[data-strip-track]');

const cur = { x: innerWidth / 2, y: innerHeight / 2, tx: innerWidth / 2, ty: innerHeight / 2 };
const pv  = { x: innerWidth / 2, y: innerHeight / 2 };
let stripX = 0, stripVel = 0;

addEventListener('pointermove', e => { cur.tx = e.clientX; cur.ty = e.clientY; });

function tick(now) {
  const t = now * 0.001;

  mouse.x = lerp(mouse.x, mouse.tx, 0.06);
  mouse.y = lerp(mouse.y, mouse.ty, 0.06);

  const max = document.documentElement.scrollHeight - innerHeight;
  scrollP = max > 0 ? clamp01(scrollY / max) : 0;

  if (gl) gl.frame(t);

  // cursor
  cur.x = lerp(cur.x, cur.tx, 0.18);
  cur.y = lerp(cur.y, cur.ty, 0.18);
  if (cursorEl) cursorEl.style.transform = `translate(${cur.x}px, ${cur.y}px) translate(-50%,-50%)`;

  // work preview follows with more drag
  pv.x = lerp(pv.x, cur.tx, 0.09);
  pv.y = lerp(pv.y, cur.ty, 0.09);
  if (previewEl) {
    previewEl.style.left = pv.x + 'px';
    previewEl.style.top = pv.y + 'px';
  }

  // velocity-reactive marquee — wrap on the offset of the repeated half
  if (stripTrack) {
    stripVel *= 0.93;
    stripX -= 1.1 + Math.abs(stripVel);
    const half = stripTrack.children[2]?.offsetLeft || 0;
    if (half && Math.abs(stripX) >= half) stripX += half;
    stripTrack.style.transform = `translate3d(${stripX}px,0,0)`;
  }

  requestAnimationFrame(tick);
}

/* =========================================================
   PRELOADER → HERO INTRO
   ========================================================= */
function intro() {
  const loader = document.getElementById('loader');
  const bar = document.getElementById('loaderBar');
  const pct = document.getElementById('loaderPct');
  const words = document.getElementById('loaderWords');
  const heroLines = document.querySelectorAll('.hero__title .line__i');
  const fades = document.querySelectorAll('[data-anim="fade"]');

  const release = () => {
    document.body.classList.remove('is-loading');
    if (HAS_GSAP) ScrollTrigger.refresh();
  };

  if (!HAS_GSAP || REDUCED) {
    loader.style.display = 'none';
    release();
    return;
  }

  // safety net: a backgrounded tab pauses rAF, which would stall the timeline
  // and leave the page scroll-locked. Force the page open if that happens.
  const bail = setTimeout(() => {
    if (document.body.classList.contains('is-loading')) {
      gsap.set(loader, { display: 'none' });
      gsap.set('.hero__title .line__i, [data-anim="fade"], .ticker', { clearProps: 'all' });
      release();
    }
  }, 9000);

  const lineH = words.querySelector('span').offsetHeight;
  const counter = { v: 0 };

  const tl = gsap.timeline();

  // derived from the markup so adding/removing a word can't desync the step count
  const steps = Math.max(1, words.children.length - 1);

  tl.to(words, {
    y: -lineH * steps, duration: 2.0, ease: `steps(${steps})`,
  }, 0)
  .to(counter, {
    v: 100, duration: 2.0, ease: 'power1.inOut',
    onUpdate() {
      const n = Math.round(counter.v);
      pct.textContent = String(n).padStart(3, '0');
      bar.style.width = n + '%';
    }
  }, 0)
  .to('.loader__curtain', { y: '0%', duration: .8, ease: 'expo.inOut' }, '>-0.1')
  .set(loader, { className: 'loader is-done' })
  .to(loader, { yPercent: -100, duration: 1.0, ease: 'expo.inOut' }, '>0.15')
  .add(() => { clearTimeout(bail); release(); }, '<')
  .from(heroLines, { yPercent: 115, duration: 1.25, ease: 'expo.out', stagger: .09 }, '<0.15')
  .from(fades, { y: 26, opacity: 0, duration: .9, ease: 'power3.out', stagger: .12 }, '<0.3')
  .from('.ticker', { yPercent: 100, duration: .9, ease: 'expo.out' }, '<0.1')
  .set(loader, { display: 'none' });
}

/* =========================================================
   SCROLL ANIMATIONS
   ========================================================= */
function scrollAnims() {
  if (!HAS_GSAP || REDUCED) {
    document.querySelectorAll('.manifesto__text').forEach(el => el.style.opacity = 1);
    return;
  }

  // manifesto: word-by-word brightening
  document.querySelectorAll('[data-split="words"]').forEach(el => {
    const words = splitWords(el);
    gsap.to(words, {
      opacity: 1, ease: 'none', stagger: .5,
      scrollTrigger: { trigger: el, start: 'top 78%', end: 'bottom 55%', scrub: .6 }
    });
  });

  // section titles: char stagger
  document.querySelectorAll('[data-split="chars"]').forEach(el => {
    const chars = splitChars(el);
    gsap.from(chars, {
      yPercent: 110, duration: 1, ease: 'expo.out', stagger: .035,
      scrollTrigger: { trigger: el, start: 'top 88%' }
    });
  });

  // discipline cards
  gsap.from('.mcard', {
    yPercent: 22, opacity: 0, duration: 1, ease: 'expo.out', stagger: .08,
    scrollTrigger: { trigger: '.manifesto__grid', start: 'top 85%' }
  });

  // toolkit rows
  gsap.from('.toolrow', {
    y: 44, opacity: 0, duration: .95, ease: 'expo.out', stagger: .08,
    scrollTrigger: { trigger: '.toolset', start: 'top 82%' }
  });

  // work rows
  gsap.from('.work-row', {
    yPercent: 45, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: .07,
    scrollTrigger: { trigger: '.worklist', start: 'top 82%' }
  });

  // Pinned horizontal gallery — desktop/tablet only. On touch-sized screens the
  // pin fights native scrolling, so the CSS hands the section a real swipeable
  // overflow container instead. matchMedia sets up/tears down across the breakpoint.
  const track = document.getElementById('galleryTrack');
  if (track) {
    gsap.matchMedia().add('(min-width: 901px)', () => {
      const dist = () => Math.max(0, track.scrollWidth - innerWidth + 40);
      gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: {
          trigger: '.gallery', start: 'top top', end: () => '+=' + dist(),
          pin: '.gallery__pin', scrub: 1, invalidateOnRefresh: true, anticipatePin: 1,
        }
      });
    });
  }

  // timeline draw
  gsap.to('#tlLine', {
    scaleY: 1, ease: 'none',
    scrollTrigger: { trigger: '.timeline', start: 'top 75%', end: 'bottom 85%', scrub: .5 }
  });
  gsap.from('.tl-item', {
    y: 50, opacity: 0, duration: 1, ease: 'expo.out', stagger: .12,
    scrollTrigger: { trigger: '.timeline', start: 'top 78%' }
  });

  // contact
  gsap.from('.contact__title .line__i', {
    yPercent: 115, duration: 1.3, ease: 'expo.out', stagger: .1,
    scrollTrigger: { trigger: '.contact', start: 'top 72%' }
  });

  // marquee reacts to scroll velocity
  ScrollTrigger.create({ onUpdate: self => { stripVel = self.getVelocity() / 260; } });

  // Window resize / device rotation leaves the pin spacer at its old width, which
  // shows up as phantom horizontal overflow until something forces a re-measure.
  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => ScrollTrigger.refresh(), 180);
  });
}

/* =========================================================
   INTERACTIONS
   ========================================================= */
function interactions() {
  const label = document.getElementById('cursorLabel');
  const LABELS = { hover: '', view: 'View', mail: 'Say hi' };

  document.querySelectorAll('[data-cursor]').forEach(el => {
    const kind = el.dataset.cursor;
    el.addEventListener('mouseenter', () => {
      if (!cursorEl) return;
      const txt = LABELS[kind] ?? '';
      const size = txt ? 74 : 44;
      cursorEl.style.width = cursorEl.style.height = size + 'px';
      cursorEl.style.mixBlendMode = txt ? 'normal' : 'difference';
      if (label) { label.textContent = txt; label.style.opacity = txt ? '1' : '0'; }
    });
    el.addEventListener('mouseleave', () => {
      if (!cursorEl) return;
      cursorEl.style.width = cursorEl.style.height = '14px';
      cursorEl.style.mixBlendMode = 'difference';
      if (label) label.style.opacity = '0';
    });
  });
  if (cursorEl) cursorEl.style.transition = 'width .4s cubic-bezier(.16,1,.3,1), height .4s cubic-bezier(.16,1,.3,1)';

  // work-row → preview image. Centring lives in GSAP's transform (xPercent/yPercent)
  // so the rAF loop can own left/top without the two fighting.
  if (previewEl && HAS_GSAP) gsap.set(previewEl, { xPercent: -50, yPercent: -50, scale: .85 });

  const imgs = {};
  document.querySelectorAll('.preview__i').forEach(i => { imgs[i.classList[1]] = i; });
  document.querySelectorAll('.work-row').forEach(row => {
    const img = imgs[row.dataset.img];
    row.addEventListener('mouseenter', () => {
      if (!previewEl || !img || !HAS_GSAP) return;
      gsap.to(previewEl, { opacity: 1, scale: 1, duration: .55, ease: 'expo.out' });
      gsap.to(Object.values(imgs), { opacity: 0, duration: .3 });
      gsap.to(img, { opacity: 1, duration: .45 });
      gsap.fromTo(img, { scale: 1.25 }, { scale: 1, duration: 1.1, ease: 'expo.out' });
    });
    row.addEventListener('mouseleave', () => {
      if (!previewEl || !HAS_GSAP) return;
      gsap.to(previewEl, { opacity: 0, duration: .35, ease: 'power2.out' });
    });
  });
  // magnetic button
  const magnet = document.querySelector('.magnet');
  if (magnet && HAS_GSAP && !REDUCED) {
    const strength = .35;
    magnet.addEventListener('mousemove', e => {
      const r = magnet.getBoundingClientRect();
      gsap.to(magnet, {
        x: (e.clientX - (r.left + r.width / 2)) * strength,
        y: (e.clientY - (r.top + r.height / 2)) * strength * 1.6,
        duration: .6, ease: 'power3.out'
      });
    });
    magnet.addEventListener('mouseleave', () => {
      gsap.to(magnet, { x: 0, y: 0, duration: .9, ease: 'elastic.out(1,.35)' });
    });
  }

  // live clock
  const c1 = document.getElementById('clock');
  const c2 = document.getElementById('clock2');
  const tickClock = () => {
    const s = new Date().toLocaleTimeString('en-GB', { hour12: false });
    if (c1) c1.textContent = s;
    if (c2) c2.textContent = 'Local ' + s;
  };
  tickClock();
  setInterval(tickClock, 1000);
}

/* =========================================================
   BOOT
   ========================================================= */
initGL();
requestAnimationFrame(tick);
scrollAnims();
interactions();
document.fonts?.ready.then(() => HAS_GSAP && ScrollTrigger.refresh());
addEventListener('load', intro);
