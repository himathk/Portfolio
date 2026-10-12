/* Sound, synthesised in the browser so there is nothing to download.
 *
 * Only deliberate moments make a sound: a print turning over, the CASE CLOSED
 * stamp landing, a reel going on the projector and the projector running, the
 * switch itself. Browsers keep audio locked until the first click or key press,
 * so a sound due before then (the stamp is set off by scrolling) is simply
 * skipped. The mute choice is remembered per visitor.
 */

export type Sfx = 'flip' | 'stamp' | 'tick' | 'clack';

const KEY = 'sfx-muted';

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let noise: AudioBuffer | null = null;
let muted = false;
let read = false;
const subs = new Set<(m: boolean) => void>();

export function isMuted(): boolean {
  if (!read) {
    read = true;
    try {
      muted = localStorage.getItem(KEY) === '1';
    } catch {
      // storage blocked: keep the default
    }
  }
  return muted;
}

export function setMuted(m: boolean) {
  muted = m;
  read = true;
  try {
    localStorage.setItem(KEY, m ? '1' : '0');
  } catch {
    // storage blocked: the choice lasts for this page view only
  }
  subs.forEach((fn) => fn(m));
  // the projector's running sound follows the switch
  if (m) stopRun();
  else if (wantRun) startRun();
}

export function onMuteChange(fn: (m: boolean) => void): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}

/** Creates or wakes the audio graph. Call from a click or key handler. */
export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    out = ctx.createGain();
    out.gain.value = 0.3;
    out.connect(ctx.destination);
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
}

/** An envelope that opens fast and dies away, without the click of a hard edge. */
function env(g: GainNode, t: number, peak: number, attack: number, release: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
}

export function play(name: Sfx) {
  if (isMuted() || !ctx || !out || !noise || ctx.state !== 'running') return;
  const t = ctx.currentTime;

  if (name === 'flip') {
    // paper turning: a breath of noise swept up through a band-pass
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(800, t);
    bp.frequency.exponentialRampToValueAtTime(3600, t + 0.18);
    const g = ctx.createGain();
    env(g, t, 0.55, 0.035, 0.2);
    src.connect(bp).connect(g).connect(out);
    src.start(t, Math.random() * 0.2);
    src.stop(t + 0.26);
  } else if (name === 'stamp') {
    // a rubber stamp: a low thump, with the slap of rubber on paper over it
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.13);
    const og = ctx.createGain();
    env(og, t, 0.9, 0.004, 0.2);
    o.connect(og).connect(out);
    o.start(t);
    o.stop(t + 0.24);

    const n = ctx.createBufferSource();
    n.buffer = noise;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    const ng = ctx.createGain();
    env(ng, t, 0.6, 0.002, 0.07);
    n.connect(lp).connect(ng).connect(out);
    n.start(t);
    n.stop(t + 0.1);
  } else if (name === 'clack') {
    // a projector's claw pulling the film down a frame: a dry click with a
    // little body under it
    const n = ctx.createBufferSource();
    n.buffer = noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    const ng = ctx.createGain();
    env(ng, t, 0.45, 0.001, 0.035);
    n.connect(hp).connect(ng).connect(out);
    n.start(t, Math.random() * 0.3);
    n.stop(t + 0.06);
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(210, t);
    o.frequency.exponentialRampToValueAtTime(80, t + 0.05);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const og = ctx.createGain();
    env(og, t, 0.16, 0.002, 0.06);
    o.connect(lp).connect(og).connect(out);
    o.start(t);
    o.stop(t + 0.09);
  } else {
    // a soft tick: sound just switched on
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(1700, t);
    o.frequency.exponentialRampToValueAtTime(850, t + 0.05);
    const g = ctx.createGain();
    env(g, t, 0.3, 0.003, 0.06);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.08);
  }
}

/* The projector running: the shutter chattering at 24 frames a second over the
 * motor's hum, quiet enough to sit under everything else. It fades in and out
 * rather than cutting, and stops whenever sound is switched off. */
let wantRun = false;
let run: { stop: () => void } | null = null;

function startRun() {
  if (run || isMuted() || !ctx || !out || !noise || ctx.state !== 'running') return;
  const c = ctx;
  const t = c.currentTime;
  const master = c.createGain();
  master.gain.setValueAtTime(0.0001, t);
  master.gain.exponentialRampToValueAtTime(0.1, t + 0.8);
  master.connect(out);

  const n = c.createBufferSource();
  n.buffer = noise;
  n.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1500;
  bp.Q.value = 1.1;
  const chop = c.createGain();
  chop.gain.value = 0.45;
  const lfo = c.createOscillator();
  lfo.type = 'square';
  lfo.frequency.value = 24;
  const depth = c.createGain();
  depth.gain.value = 0.45;
  lfo.connect(depth).connect(chop.gain);
  n.connect(bp).connect(chop).connect(master);

  const motor = c.createOscillator();
  motor.type = 'sawtooth';
  motor.frequency.value = 50;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 170;
  const mg = c.createGain();
  mg.gain.value = 0.4;
  motor.connect(lp).connect(mg).connect(master);

  n.start(t);
  lfo.start(t);
  motor.start(t);
  run = {
    stop: () => {
      const t2 = c.currentTime;
      master.gain.cancelScheduledValues(t2);
      master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t2);
      master.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.4);
      [n, lfo, motor].forEach((s) => s.stop(t2 + 0.45));
    },
  };
}

function stopRun() {
  run?.stop();
  run = null;
}

/** Start or stop the projector's running sound. */
export function projectorRun(on: boolean) {
  wantRun = on;
  if (on) startRun();
  else stopRun();
}
