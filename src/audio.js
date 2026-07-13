// audio.js — WebAudio chiptune boom-bap. 808-ish drums from synthesis,
// square-wave bass and lead, seeded 2-bar patterns so each scene has its
// own beat. Plus spray hiss / siren / pop SFX.

import { makeRng, pick } from './rng.js';

let ac = null, master = null;
let beat = null; // { timer, ... }
let sprayNode = null;

export function initAudio() {
  if (ac) return;
  ac = new (window.AudioContext || window.webkitAudioContext)();
  master = ac.createGain();
  master.gain.value = 0.5;
  master.connect(ac.destination);
}

export function resumeAudio() {
  if (ac && ac.state === 'suspended') ac.resume();
}

function noiseBuffer() {
  const len = ac.sampleRate * 0.5;
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
let _noise = null;
function getNoise() { return (_noise ||= noiseBuffer()); }

function kick(t) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
  g.gain.setValueAtTime(0.9, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + 0.2);
}

function snare(t) {
  const s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
  s.buffer = getNoise();
  f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  s.connect(f).connect(g).connect(master);
  s.start(t); s.stop(t + 0.15);
}

function hat(t, open) {
  const s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
  s.buffer = getNoise();
  f.type = 'highpass'; f.frequency.value = 7000;
  const dur = open ? 0.18 : 0.04;
  g.gain.setValueAtTime(0.18, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t); s.stop(t + dur + 0.01);
}

function tone(t, freq, dur, vol = 0.12, type = 'square') {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function square(t, freq, dur, vol = 0.12) { tone(t, freq, dur, vol, 'square'); }

const MINOR_PENT = [0, 3, 5, 7, 10];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
function noteFreq(root, semis) { return root * Math.pow(2, semis / 12); }

function rim(t) {
  tone(t, 1700, 0.018, 0.10);
}

function bell(t) {
  tone(t, 800, 0.05, 0.09);
  tone(t, 540, 0.05, 0.07);
}

// ---- The beat machine -------------------------------------------------------
// Five styles, all seeded, so every scene and every night sounds
// different: boom-bap with swing, electro (Planet Rock energy), funk
// with ghost notes, a latin groove with clave + cowbell, and a mellow
// gallery mode.

const STYLES = {
  boombap: { bpm: [86, 98], swing: 0.16, bassWave: 'square', leadWave: 'square' },
  electro: { bpm: [112, 126], swing: 0, bassWave: 'square', leadWave: 'square' },
  funk:    { bpm: [94, 104], swing: 0.12, bassWave: 'square', leadWave: 'square' },
  latin:   { bpm: [100, 112], swing: 0, bassWave: 'triangle', leadWave: 'triangle' },
  mellow:  { bpm: [66, 76], swing: 0.1, bassWave: 'triangle', leadWave: 'sine' },
};

function makePattern(seed, style) {
  const rng = makeRng(seed);
  const st = STYLES[style] || STYLES.boombap;
  const root = pick(rng, [49, 55, 58.27, 61.74, 65.41]);
  const scale = style === 'latin' || style === 'mellow' ? MINOR : MINOR_PENT;
  const kicks = new Array(32).fill(0);
  const snares = new Array(32).fill(0);   // 1 = full, 2 = ghost
  const hats = new Array(32).fill(0);     // 1 = closed, 2 = open
  const rims = new Array(32).fill(0);
  const bells = new Array(32).fill(0);
  const bass = new Array(32).fill(null);
  const lead = new Array(32).fill(null);

  for (let bar = 0; bar < 2; bar++) {
    const o = bar * 16;
    if (style === 'electro') {
      kicks[o] = 1; kicks[o + 6] = 1; kicks[o + (bar ? 12 : 10)] = 1;
      snares[o + 4] = 1; snares[o + 12] = 1;
      for (let i = 0; i < 16; i++) hats[o + i] = i % 2 ? 1 : 0;
      hats[o + 14] = 2;
      for (let i = 0; i < 16; i += 2) {
        bass[o + i] = noteFreq(root, i % 8 === 6 ? 7 : (i % 4 === 2 ? 12 : 0));
      }
    } else if (style === 'funk') {
      kicks[o] = 1; kicks[o + 7] = 1; kicks[o + 10] = 1;
      if (rng() < 0.5) kicks[o + 13] = 1;
      snares[o + 4] = 1; snares[o + 12] = 1;
      for (let i = 1; i < 16; i += 2) if (rng() < 0.3) snares[o + i] = 2; // ghosts
      for (let i = 0; i < 16; i += 2) hats[o + i] = 1;
      hats[o + 10] = 2;
      const funkNotes = [0, 0, 12, 7, 0, 10, 12, 0];
      for (let i = 0; i < 16; i++) {
        if ([0, 3, 6, 8, 11, 14].includes(i) && rng() < 0.85) {
          bass[o + i] = noteFreq(root, funkNotes[Math.floor(rng() * funkNotes.length)]);
        }
      }
    } else if (style === 'latin') {
      kicks[o] = 1; kicks[o + 8] = 1;
      // son clave on the rim
      for (const cs of bar % 2 === 0 ? [0, 3, 6] : [2, 4]) rims[o + cs * 2] = 1;
      for (let i = 0; i < 16; i += 4) bells[o + i] = 1;
      bells[o + 10] = 1;
      snares[o + 12] = 1;
      for (let i = 0; i < 16; i += 2) hats[o + i] = 1;
      // tumbao-ish bass
      bass[o + 3] = noteFreq(root, 7);
      bass[o + 6] = noteFreq(root, 0);
      bass[o + 10] = noteFreq(root, 7);
      bass[o + 14] = noteFreq(root, 12);
    } else if (style === 'mellow') {
      kicks[o] = 1;
      snares[o + 8] = 1;
      for (let i = 0; i < 16; i += 4) hats[o + i] = 1;
      if (rng() < 0.8) bass[o] = noteFreq(root, 0);
      if (rng() < 0.5) bass[o + 8] = noteFreq(root, pick(rng, [3, 5, 7]));
    } else { // boombap
      kicks[o] = 1;
      kicks[o + (rng() < 0.5 ? 7 : 10)] = 1;
      if (rng() < 0.5) kicks[o + 3] = 1;
      snares[o + 4] = 1; snares[o + 12] = 1;
      if (rng() < 0.3) snares[o + 15] = 2;
      for (let i = 0; i < 16; i += 2) hats[o + i] = rng() < 0.12 ? 2 : 1;
      for (let i = 0; i < 16; i += 4) {
        if (rng() < 0.8) bass[o + i] = noteFreq(root, pick(rng, MINOR_PENT));
        if (rng() < 0.3) bass[o + i + 2] = noteFreq(root, pick(rng, MINOR_PENT));
      }
    }
  }

  // lead melody: an arp for electro, riffs elsewhere
  if (style === 'electro') {
    const arp = [0, 3, 7, 12];
    for (let i = 0; i < 32; i += 2) {
      if (rng() < 0.5) lead[i] = noteFreq(root * 4, arp[(i / 2) % 4]);
    }
  } else {
    const dens = style === 'mellow' ? 0.08 : style === 'funk' ? 0.16 : 0.12;
    for (let i = 0; i < 32; i++) {
      if (rng() < dens) lead[i] = noteFreq(root * 4, pick(rng, scale));
    }
  }

  const bpm = st.bpm[0] + Math.floor(rng() * (st.bpm[1] - st.bpm[0]));
  return {
    kicks, snares, hats, rims, bells, bass, lead, bpm,
    swing: st.swing, bassWave: st.bassWave, leadWave: st.leadWave,
    leadDur: style === 'mellow' ? 1.6 : 0.9,
    bassVol: style === 'mellow' ? 0.10 : 0.14,
  };
}

export function playBeat(seed, style = 'boombap') {
  if (!ac) return;
  if (style === true) style = 'mellow'; // old boolean callers
  stopBeat();
  stopAmbience();
  const pat = makePattern(seed, style);
  const stepDur = 60 / pat.bpm / 4;
  let step = 0;
  let nextTime = ac.currentTime + 0.05;
  const timer = setInterval(() => {
    if (!ac) return;
    while (nextTime < ac.currentTime + 0.15) {
      const s = step % 32;
      const t = nextTime + (s % 2 === 1 ? stepDur * pat.swing : 0);
      if (pat.kicks[s]) kick(t);
      if (pat.snares[s] === 1) snare(t);
      if (pat.snares[s] === 2) { const g = t; tone(g, 1800, 0.05, 0.06); } // ghost tap
      if (pat.hats[s]) hat(t, pat.hats[s] === 2);
      if (pat.rims[s]) rim(t);
      if (pat.bells[s]) bell(t);
      if (pat.bass[s]) tone(t, pat.bass[s], stepDur * 1.8, pat.bassVol, pat.bassWave);
      if (pat.lead[s]) tone(t, pat.lead[s], stepDur * pat.leadDur, 0.05, pat.leadWave);
      nextTime += stepDur;
      step++;
    }
  }, 60);
  beat = { timer };
}

export function stopBeat() {
  if (beat) { clearInterval(beat.timer); beat = null; }
}

// ---- Ambience -------------------------------------------------------------
// The city is never quiet. Trains rumble; streets hum.

let amb = null;

export function startAmbience(kind) {
  if (!ac) return;
  stopAmbience();
  if (kind === 'gallery') return; // hushed. you can hear the wine pour.
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = getNoise(); s.loop = true;
  f.type = 'lowpass';
  f.frequency.value = kind === 'train' ? 95 : 150;
  g.gain.value = kind === 'train' ? 0.09 : 0.035;
  // slow swell so the rumble breathes
  const lfo = ac.createOscillator(), lg = ac.createGain();
  lfo.frequency.value = 0.13;
  lg.gain.value = kind === 'train' ? 0.04 : 0.012;
  lfo.connect(lg).connect(g.gain);
  s.connect(f).connect(g).connect(master);
  s.start(); lfo.start();
  amb = { s, lfo };
}

export function stopAmbience() {
  if (!amb) return;
  try { amb.s.stop(); amb.lfo.stop(); } catch (e) { /* already stopped */ }
  amb = null;
}

// ---- SFX ----------------------------------------------------------------

export function sfxSpray(on) {
  if (!ac) return;
  if (on && !sprayNode) {
    const s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
    s.buffer = getNoise(); s.loop = true;
    f.type = 'highpass'; f.frequency.value = 3000;
    g.gain.value = 0.10;
    s.connect(f).connect(g).connect(master);
    s.start();
    sprayNode = s;
  } else if (!on && sprayNode) {
    try { sprayNode.stop(); } catch (e) { /* already stopped */ }
    sprayNode = null;
  }
}

export function sfxPop() {
  if (!ac) return;
  const t = ac.currentTime;
  square(t, 660, 0.06, 0.2);
  square(t + 0.07, 990, 0.12, 0.2);
}

export function sfxTick() {
  if (!ac) return;
  square(ac.currentTime, 440, 0.03, 0.08);
}

export function sfxSiren() {
  if (!ac) return;
  const t = ac.currentTime;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'triangle';
  for (let i = 0; i < 4; i++) {
    o.frequency.setValueAtTime(700, t + i * 0.5);
    o.frequency.linearRampToValueAtTime(500, t + i * 0.5 + 0.45);
  }
  g.gain.setValueAtTime(0.15, t);
  g.gain.setValueAtTime(0.15, t + 1.9);
  g.gain.linearRampToValueAtTime(0, t + 2);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + 2);
}

export function sfxWhistle() {
  if (!ac) return;
  const t = ac.currentTime;
  square(t, 1800, 0.1, 0.12);
  square(t + 0.12, 2200, 0.15, 0.12);
}

export function sfxBust() {
  if (!ac) return;
  const t = ac.currentTime;
  for (let i = 0; i < 5; i++) square(t + i * 0.09, 300 - i * 40, 0.08, 0.2);
}

export function sfxRattle() {
  if (!ac) return;
  const t = ac.currentTime;
  // the ball in the can
  tone(t, 2100, 0.02, 0.10);
  tone(t + 0.06, 1800, 0.02, 0.10);
  tone(t + 0.11, 2300, 0.02, 0.08);
}

export function sfxTwinkle() {
  if (!ac) return;
  const t = ac.currentTime;
  tone(t, 1900, 0.07, 0.05, 'sine');
  tone(t + 0.06, 2600, 0.10, 0.05, 'sine');
}

export function sfxWhoosh() {
  if (!ac) return;
  const t = ac.currentTime;
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = getNoise();
  f.type = 'bandpass'; f.Q.value = 1.2;
  f.frequency.setValueAtTime(250, t);
  f.frequency.linearRampToValueAtTime(900, t + 0.25);
  f.frequency.linearRampToValueAtTime(300, t + 0.55);
  g.gain.setValueAtTime(0.0, t);
  g.gain.linearRampToValueAtTime(0.07, t + 0.2);
  g.gain.linearRampToValueAtTime(0.0, t + 0.6);
  s.connect(f).connect(g).connect(master);
  s.start(t); s.stop(t + 0.65);
}

// the two-tone subway door chime
export function sfxChime() {
  if (!ac) return;
  const t = ac.currentTime;
  tone(t, 659, 0.28, 0.14, 'sine');
  tone(t + 0.22, 523, 0.4, 0.14, 'sine');
}

export function sfxDoorSlide() {
  if (!ac) return;
  const t = ac.currentTime;
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = getNoise();
  f.type = 'lowpass'; f.frequency.value = 500;
  g.gain.setValueAtTime(0.0, t);
  g.gain.linearRampToValueAtTime(0.10, t + 0.15);
  g.gain.linearRampToValueAtTime(0.02, t + 1.0);
  g.gain.linearRampToValueAtTime(0.0, t + 1.2);
  s.connect(f).connect(g).connect(master);
  s.start(t); s.stop(t + 1.25);
}

export function sfxClink() {
  if (!ac) return;
  const t = ac.currentTime;
  tone(t, 2400, 0.05, 0.05, 'sine');
  tone(t + 0.02, 3300, 0.08, 0.04, 'sine');
}

export function sfxBark() {
  if (!ac) return;
  const t = ac.currentTime;
  square(t, 140, 0.07, 0.25);
  square(t + 0.02, 90, 0.09, 0.22);
  square(t + 0.16, 150, 0.07, 0.25);
  square(t + 0.18, 95, 0.09, 0.22);
}

export function sfxCash() {
  if (!ac) return;
  const t = ac.currentTime;
  square(t, 880, 0.05, 0.12);
  square(t + 0.06, 1320, 0.09, 0.12);
}
