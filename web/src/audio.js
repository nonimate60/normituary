// Tiny 8-bit SFX synth + lazy AudioContext access.

let ctx = null;

export function audioCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

function envOsc({ type = 'square', freq, freqEnd, dur = 0.08, gain = 0.15 }) {
  const ac = audioCtx();
  if (!ac) return;
  if (ac.state === 'suspended') ac.resume();
  const t0 = ac.currentTime;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noiseBurst({ dur = 0.06, gain = 0.18 }) {
  const ac = audioCtx();
  if (!ac) return;
  const buf = ac.createBuffer(1, Math.max(1, Math.floor(ac.sampleRate * dur)), ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ac.createBufferSource();
  const g = ac.createGain();
  g.gain.value = gain;
  src.buffer = buf;
  src.connect(g).connect(ac.destination);
  src.start();
}

export function playClick() {
  envOsc({ type: 'square', freq: 880, freqEnd: 220, dur: 0.07, gain: 0.12 });
}

export function playHit() {
  envOsc({ type: 'square', freq: 520, freqEnd: 60, dur: 0.18, gain: 0.18 });
  noiseBurst({ dur: 0.08, gain: 0.12 });
}
