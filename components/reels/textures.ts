import * as THREE from 'three';
import type { Project } from '@/lib/projects';

/* Everything on the cans and the projector that is printed, pressed or punched
 * is drawn here on a canvas, in the site's own type. */

/** Fonts come from next/font, which names them by hash; read the real family
 *  lists off the CSS variables it sets so the canvas draws in the site's type. */
export function families() {
  const cs = getComputedStyle(document.documentElement);
  const get = (v: string, fb: string) => cs.getPropertyValue(v).trim() || fb;
  return {
    display: get('--font-display', 'system-ui, sans-serif'),
    serif: get('--font-serif', 'Georgia, serif'),
    mono: get('--font-mono', 'ui-monospace, monospace'),
  };
}

export function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
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

/** The tape on a can's lid: reel number, year, title and role. */
export function labelTexture(p: Project) {
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

/** The strip of tape round a lid's rim, readable while the cans are stacked. */
export function bandTexture(p: Project) {
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
export function lidTexture() {
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

/** Six windows punched round a reel's flange, between `r0` and `r1` of 256. */
function windows(ctx: CanvasRenderingContext2D, c: number, r0: number, r1: number) {
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 - Math.PI / 2;
    const half = 0.36;
    ctx.beginPath();
    ctx.arc(c, c, r1, a - half, a + half);
    ctx.arc(c, c, r0, a + half * 0.8, a - half * 0.8, true);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * The face of a reel: a pressed metal flange with six windows, film wound
 * behind it showing through. `full` is how much film is on it, 1 for a reel
 * fresh from its can, a little for the take-up reel. Transparent where there
 * is neither film nor metal, so an empty reel is see-through.
 */
export function reelFaceTexture(full: number) {
  return canvasTex(512, 512, (ctx) => {
    const c = 256;
    const pack = 70 + full * 165;
    // the film, wound on its core
    ctx.fillStyle = '#17110c';
    ctx.beginPath();
    ctx.arc(c, c, pack, 0, Math.PI * 2);
    ctx.fill();
    for (let r = pack - 2; r > 62; r -= 1.6) {
      ctx.strokeStyle = `rgba(150,110,70,${0.04 + Math.random() * 0.08})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // the flange over it, with its windows punched out
    const flange = document.createElement('canvas');
    flange.width = flange.height = 512;
    const fx = flange.getContext('2d')!;
    const g = fx.createRadialGradient(c - 60, c - 80, 20, c, c, 256);
    g.addColorStop(0, '#f2f3f5');
    g.addColorStop(1, '#b9bdc5');
    fx.fillStyle = g;
    fx.beginPath();
    fx.arc(c, c, 252, 0, Math.PI * 2);
    fx.fill();
    // a pressed ring near the rim
    fx.strokeStyle = 'rgba(0,0,0,.18)';
    fx.lineWidth = 3;
    fx.beginPath();
    fx.arc(c, c, 232, 0, Math.PI * 2);
    fx.stroke();
    fx.globalCompositeOperation = 'destination-out';
    windows(fx, c, 88, 214);
    fx.globalCompositeOperation = 'source-over';
    // the hub, with its square drive hole
    fx.fillStyle = '#d4d6db';
    fx.beginPath();
    fx.arc(c, c, 46, 0, Math.PI * 2);
    fx.fill();
    fx.fillStyle = '#2a2a2e';
    fx.fillRect(c - 11, c - 11, 22, 22);
    ctx.drawImage(flange, 0, 0);
  });
}

/** Lamp-house vents: the slits light up when the lamp is on. Used as an
 *  emissive map, so black is unlit and white glows. */
export function ventTexture() {
  return canvasTex(256, 256, (ctx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#fff';
    for (let y = 46; y < 220; y += 22) {
      ctx.beginPath();
      ctx.roundRect(40, y, 176, 8, 4);
      ctx.fill();
    }
  });
}

/** The badge on the projector's side. */
export function plateTexture() {
  const f = families();
  return canvasTex(512, 160, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 512, 160);
    g.addColorStop(0, '#d8b46a');
    g.addColorStop(0.5, '#f3dc9c');
    g.addColorStop(1, '#b8924a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(4, 4, 504, 152, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,40,10,.55)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(16, 16, 480, 128, 10);
    ctx.stroke();
    ctx.fillStyle = '#2b1d08';
    ctx.textAlign = 'center';
    ctx.font = `900 64px ${f.display}`;
    ctx.fillText('HK·16', 256, 92);
    ctx.font = `500 22px ${f.mono}`;
    ctx.fillText('SOUND PROJECTOR', 256, 128);
  });
}

/** 16mm film for the threading path: dark base, a row of sprocket holes. */
export function threadTexture() {
  return canvasTex(512, 32, (ctx) => {
    ctx.fillStyle = '#1b140e';
    ctx.fillRect(0, 0, 512, 32);
    ctx.fillStyle = 'rgba(200,150,90,.25)';
    ctx.fillRect(0, 13, 512, 6);
    ctx.globalCompositeOperation = 'destination-out';
    for (let x = 6; x < 512; x += 24) {
      ctx.beginPath();
      ctx.roundRect(x, 3, 10, 7, 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  });
}

/** A soft round glow, for the lens and the dust in the beam. */
export function glowTexture() {
  return canvasTex(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
}
