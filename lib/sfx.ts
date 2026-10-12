/* Sound, synthesised in the browser so there is nothing to download.
 *
 * Only deliberate moments make a sound: a print turning over, the CASE CLOSED
 * stamp landing, the switch itself. Browsers keep audio locked until the first
 * click or key press, so a sound due before then (the stamp is set off by
 * scrolling) is simply skipped. The mute choice is remembered per visitor.
 */

export type Sfx = 'flip' | 'stamp' | 'tick';

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
