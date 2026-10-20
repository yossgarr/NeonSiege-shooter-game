'use strict';
/* =========================================================
   AUDIO — everything synthesised with WebAudio (no files)
   ========================================================= */
const SND = { ctx: null, master: null, sfx: null, music: null, verb: null, noise: null, vol: 0.7, musicOn: true, intensity: 0, paused: false };

function initAudio() {
  if (SND.ctx) { if (SND.ctx.state === 'suspended') SND.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const ctx = SND.ctx = new AC();
  SND.master = ctx.createGain(); SND.master.gain.value = SND.vol;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.15;
  SND.master.connect(comp); comp.connect(ctx.destination);
  SND.sfx = ctx.createGain(); SND.sfx.connect(SND.master);
  SND.music = ctx.createGain(); SND.music.gain.value = 0.32; SND.music.connect(SND.master);
  // noise buffer
  const len = ctx.sampleRate * 2, nb = ctx.createBuffer(1, len, ctx.sampleRate), d = nb.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  SND.noise = nb;
  // cheap algorithmic reverb impulse
  const il = ctx.sampleRate * 1.6, ib = ctx.createBuffer(2, il, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const ch = ib.getChannelData(c); for (let i = 0; i < il; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / il, 3.2); }
  const conv = ctx.createConvolver(); conv.buffer = ib;
  SND.verb = ctx.createGain(); SND.verb.gain.value = 0.5; SND.verb.connect(conv); conv.connect(SND.master);
  startAmbient();
}
function setVolume(v) { SND.vol = v; if (SND.master) SND.master.gain.value = v; }

// route: voice -> gain -> panner -> (sfx bus + reverb send)
function route(vol, pan, verb) {
  const ctx = SND.ctx, g = ctx.createGain(); g.gain.value = vol;
  let out = g;
  if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); out = p; }
  out.connect(SND.sfx);
  if (verb) { const s = ctx.createGain(); s.gain.value = verb; out.connect(s); s.connect(SND.verb); }
  return g;
}
function nz(o, dest) {
  const ctx = SND.ctx, t = ctx.currentTime + (o.delay || 0);
  const s = ctx.createBufferSource(); s.buffer = SND.noise; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = o.type || 'lowpass'; f.Q.value = o.q || 0.8;
  f.frequency.setValueAtTime(o.f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(o.f1 || o.f0, 20), t + o.dur);
  const e = ctx.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(o.gain, t + (o.atk || 0.004)); e.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  s.connect(f); f.connect(e); e.connect(dest);
  s.start(t, Math.random()); s.stop(t + o.dur + 0.05);
}
function tn(o, dest) {
  const ctx = SND.ctx, t = ctx.currentTime + (o.delay || 0);
  const s = ctx.createOscillator(); s.type = o.wave || 'sine';
  s.frequency.setValueAtTime(o.f0, t); s.frequency.exponentialRampToValueAtTime(Math.max(o.f1 || o.f0, 20), t + o.dur);
  const e = ctx.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(o.gain, t + (o.atk || 0.004)); e.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  s.connect(e); e.connect(dest);
  s.start(t); s.stop(t + o.dur + 0.05);
}

// synthesised human voice: sawtooth through vocal formants, with vibrato
function vox(o, dest) {
  const ctx = SND.ctx, t = ctx.currentTime + (o.delay || 0), end = t + o.dur + 0.05;
  const osc = ctx.createOscillator(); osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(o.f0, t); osc.frequency.linearRampToValueAtTime(o.f1, t + o.dur);
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = o.vibHz || 6; lg.gain.value = o.vib || 8; lfo.connect(lg); lg.connect(osc.frequency);
  const env = ctx.createGain(); env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(o.gain, t + (o.atk || 0.04)); env.gain.setValueAtTime(o.gain, t + o.dur * 0.55); env.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  (o.formants || [[700, 5, 1], [1200, 6, 0.6]]).forEach(([f, q, g]) => { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; const gg = ctx.createGain(); gg.gain.value = g; osc.connect(bp); bp.connect(gg); gg.connect(env); });
  env.connect(dest); osc.start(t); lfo.start(t); osc.stop(end); lfo.stop(end);
}
const FM = [[700, 5, 1], [1200, 6, 0.7], [2600, 8, 0.35]], FF = [[900, 5, 1], [1500, 7, 0.7], [3000, 8, 0.3]];
const SFX = {
  ak47:    d => { nz({ f0: 9000, f1: 700, dur: 0.2, gain: 1.0 }, d); nz({ type: 'highpass', f0: 4000, f1: 3000, dur: 0.05, gain: 0.55 }, d); tn({ f0: 150, f1: 38, dur: 0.18, gain: 1.15 }, d); tn({ wave: 'sawtooth', f0: 700, f1: 120, dur: 0.07, gain: 0.3 }, d); nz({ f0: 1200, f1: 200, dur: 0.35, gain: 0.35, delay: 0.03 }, d); },
  flesh:   d => { nz({ f0: 1000, f1: 140, dur: 0.14, gain: 1.0 }, d); tn({ f0: 130, f1: 45, dur: 0.13, gain: 0.9 }, d); nz({ type: 'bandpass', f0: 2600, f1: 1200, dur: 0.06, gain: 0.3, q: 3, delay: 0.02 }, d); },
  headshot: d => { nz({ f0: 2800, f1: 180, dur: 0.28, gain: 1.1 }, d); tn({ f0: 95, f1: 32, dur: 0.28, gain: 1.1 }, d); nz({ type: 'highpass', f0: 2200, f1: 900, dur: 0.12, gain: 0.55 }, d); tn({ wave: 'square', f0: 1000, f1: 200, dur: 0.03, gain: 0.3 }, d); nz({ type: 'bandpass', f0: 1800, f1: 600, dur: 0.18, gain: 0.35, q: 2, delay: 0.05 }, d); },
  cry:     d => { [0, 0.34, 0.68].forEach((dl, i) => vox({ f0: 170 - i * 14, f1: 120 - i * 10, dur: 0.3, gain: 0.5, vib: 12, vibHz: 7, formants: FM, delay: dl }, d)); },
  cryF:    d => { [0, 0.32, 0.64].forEach((dl, i) => vox({ f0: 330 - i * 22, f1: 250 - i * 15, dur: 0.28, gain: 0.45, vib: 18, vibHz: 7, formants: FF, delay: dl }, d)); },
  scream:  d => { vox({ f0: 260, f1: 520, dur: 0.9, gain: 0.6, vib: 30, vibHz: 9, formants: FM, atk: 0.03 }, d); nz({ type: 'bandpass', f0: 2000, f1: 3000, dur: 0.8, gain: 0.15, q: 1.2 }, d); },
  screamF: d => { vox({ f0: 560, f1: 920, dur: 0.95, gain: 0.55, vib: 40, vibHz: 9, formants: FF, atk: 0.03 }, d); nz({ type: 'bandpass', f0: 3000, f1: 4200, dur: 0.8, gain: 0.14, q: 1.2 }, d); },
  groan:   d => { vox({ f0: 120, f1: 85, dur: 0.9, gain: 0.55, vib: 6, vibHz: 5, formants: [[500, 4, 1], [900, 5, 0.5]], atk: 0.15 }, d); },
  gasp:    d => { nz({ type: 'bandpass', f0: 800, f1: 2200, dur: 0.25, gain: 0.45, q: 1.4, atk: 0.1 }, d); vox({ f0: 200, f1: 240, dur: 0.2, gain: 0.18, formants: FM, atk: 0.08 }, d); },
  gaspF:   d => { nz({ type: 'bandpass', f0: 1200, f1: 3000, dur: 0.25, gain: 0.42, q: 1.4, atk: 0.1 }, d); vox({ f0: 380, f1: 450, dur: 0.2, gain: 0.16, formants: FF, atk: 0.08 }, d); },
  rifle:   d => { nz({ f0: 7000, f1: 500, dur: 0.14, gain: 0.7 }, d); nz({ type: 'highpass', f0: 3500, f1: 3500, dur: 0.03, gain: 0.35 }, d); tn({ f0: 170, f1: 45, dur: 0.13, gain: 0.9 }, d); },
  shotgun: d => { nz({ f0: 4500, f1: 220, dur: 0.45, gain: 1.0 }, d); nz({ f0: 1500, f1: 150, dur: 0.6, gain: 0.5, delay: 0.02 }, d); tn({ f0: 110, f1: 28, dur: 0.35, gain: 1.2 }, d); },
  pistol:  d => { nz({ f0: 5500, f1: 700, dur: 0.18, gain: 0.7 }, d); tn({ f0: 240, f1: 60, dur: 0.15, gain: 0.8 }, d); },
  rail:    d => { tn({ wave: 'sawtooth', f0: 80, f1: 2400, dur: 0.1, gain: 0.5 }, d); tn({ f0: 1800, f1: 50, dur: 0.6, gain: 0.8, delay: 0.08 }, d); nz({ type: 'bandpass', f0: 4000, f1: 300, dur: 0.5, gain: 0.5, q: 2, delay: 0.08 }, d); },
  empty:   d => { tn({ wave: 'square', f0: 900, f1: 700, dur: 0.04, gain: 0.25 }, d); },
  magout:  d => { nz({ type: 'bandpass', f0: 1800, f1: 900, dur: 0.07, gain: 0.35, q: 3 }, d); tn({ f0: 220, f1: 120, dur: 0.07, gain: 0.3 }, d); },
  magin:   d => { nz({ type: 'bandpass', f0: 1200, f1: 700, dur: 0.09, gain: 0.5, q: 2 }, d); tn({ f0: 320, f1: 160, dur: 0.1, gain: 0.5 }, d); },
  bolt:    d => { nz({ type: 'highpass', f0: 3000, f1: 2000, dur: 0.06, gain: 0.5 }, d); tn({ wave: 'square', f0: 500, f1: 300, dur: 0.05, gain: 0.2 }, d); },
  eshot:   d => { tn({ wave: 'sawtooth', f0: 900, f1: 220, dur: 0.2, gain: 0.32 }, d); nz({ type: 'highpass', f0: 2500, f1: 1000, dur: 0.08, gain: 0.2 }, d); },
  eheavy:  d => { tn({ wave: 'sawtooth', f0: 380, f1: 70, dur: 0.3, gain: 0.5 }, d); tn({ wave: 'square', f0: 140, f1: 50, dur: 0.25, gain: 0.3 }, d); },
  edrone:  d => { tn({ wave: 'square', f0: 1400, f1: 500, dur: 0.1, gain: 0.18 }, d); },
  hit:     d => { tn({ wave: 'triangle', f0: 1700, f1: 1500, dur: 0.05, gain: 0.45 }, d); },
  head:    d => { tn({ wave: 'triangle', f0: 2600, f1: 2200, dur: 0.09, gain: 0.55 }, d); tn({ f0: 1300, f1: 1100, dur: 0.12, gain: 0.4 }, d); },
  kill:    d => { nz({ f0: 3200, f1: 180, dur: 0.55, gain: 0.8 }, d); tn({ f0: 100, f1: 30, dur: 0.45, gain: 0.9 }, d); nz({ type: 'highpass', f0: 6000, f1: 2000, dur: 0.25, gain: 0.3 }, d); },
  hurt:    d => { nz({ f0: 900, f1: 200, dur: 0.25, gain: 0.8 }, d); tn({ f0: 90, f1: 40, dur: 0.25, gain: 0.9 }, d); },
  pickup:  d => { tn({ f0: 660, f1: 700, dur: 0.09, gain: 0.4 }, d); tn({ f0: 990, f1: 1040, dur: 0.14, gain: 0.4, delay: 0.08 }, d); },
  wave:    d => { tn({ wave: 'sawtooth', f0: 82, f1: 164, dur: 1.4, gain: 0.35, atk: 0.4 }, d); tn({ wave: 'sawtooth', f0: 123, f1: 246, dur: 1.4, gain: 0.25, atk: 0.4 }, d); nz({ f0: 300, f1: 4000, dur: 1.2, gain: 0.25, atk: 0.8 }, d); },
  clear:   d => { [523, 659, 784, 1046].forEach((f, i) => tn({ wave: 'triangle', f0: f, f1: f, dur: 0.35, gain: 0.35, delay: i * 0.09 }, d)); },
  step:    d => { nz({ type: 'bandpass', f0: 500, f1: 300, dur: 0.07, gain: 0.35, q: 1.2 }, d); },
  jump:    d => { nz({ type: 'bandpass', f0: 700, f1: 400, dur: 0.1, gain: 0.25 }, d); },
  land:    d => { nz({ f0: 600, f1: 120, dur: 0.14, gain: 0.5 }, d); tn({ f0: 90, f1: 45, dur: 0.12, gain: 0.5 }, d); },
  switch:  d => { nz({ type: 'bandpass', f0: 2200, f1: 1200, dur: 0.06, gain: 0.35, q: 2 }, d); tn({ wave: 'square', f0: 420, f1: 300, dur: 0.05, gain: 0.12 }, d); },
  melee:   d => { nz({ type: 'bandpass', f0: 600, f1: 2200, dur: 0.12, gain: 0.5, q: 1.5 }, d); },
  spawn:   d => { tn({ f0: 200, f1: 1100, dur: 0.35, gain: 0.25 }, d); nz({ type: 'highpass', f0: 1500, f1: 5000, dur: 0.3, gain: 0.15 }, d); },
  drone:   d => { tn({ wave: 'sawtooth', f0: 300, f1: 180, dur: 0.2, gain: 0.12 }, d); },
};
const SFX_VERB = { rifle: .25, ak47: .55, pistol: .4, flesh: .15, headshot: .3, scream: .35, screamF: .35, cry: .25, cryF: .25 };

// pos: optional {x,z} world position for stereo panning + distance attenuation
function sfx(name, pos, vol = 1) {
  if (!SND.ctx || SND.ctx.state !== 'running' || !SFX[name]) return;
  let pan = 0;
  if (pos && typeof camera !== 'undefined') {
    const dx = pos.x - camera.position.x, dz = pos.z - camera.position.z, d = Math.hypot(dx, dz) || 1;
    const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
    pan = (dx * rx + dz * rz) / d * Math.min(1, d / 6);
    vol *= 1 / (1 + d * 0.07);
  }
  SFX[name](route(vol, pan, SFX_VERB[name] || 0.08));
}

/* ---------------- room tone ---------------- */
function startAmbient() {
  if (SND.ambient) return;
  const ctx = SND.ctx, src = ctx.createBufferSource(); src.buffer = SND.noise; src.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160;
  const g = ctx.createGain(); g.gain.value = 0.05; src.connect(lp); lp.connect(g); g.connect(SND.music); src.start();
  SND.ambient = g;
}
function setAmbient(on) { if (SND.ambient) SND.ambient.gain.value = on ? 0.05 : 0; }
