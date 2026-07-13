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

function square(t, freq, dur, vol = 0.12) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'square';
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

const MINOR_PENT = [0, 3, 5, 7, 10];
function noteFreq(root, semis) { return root * Math.pow(2, semis / 12); }

// Seeded 2-bar (32 sixteenth-steps) pattern
function makePattern(seed) {
  const rng = makeRng(seed);
  const root = pick(rng, [55, 58.27, 61.74, 49]); // A1, Bb1, B1, G1
  const kicks = new Array(32).fill(0);
  const snares = new Array(32).fill(0);
  const hats = new Array(32).fill(0);
  const bass = new Array(32).fill(null);
  const lead = new Array(32).fill(null);
  for (let bar = 0; bar < 2; bar++) {
    const o = bar * 16;
    kicks[o] = 1;
    kicks[o + (rng() < 0.5 ? 7 : 10)] = 1;
    if (rng() < 0.5) kicks[o + 3] = 1;
    snares[o + 4] = 1; snares[o + 12] = 1;
    if (rng() < 0.3) snares[o + 15] = 1; // ghost
  }
  for (let i = 0; i < 32; i += 2) hats[i] = rng() < 0.12 ? 2 : 1; // 2 = open
  for (let i = 0; i < 32; i += 4) {
    if (rng() < 0.8) bass[i] = noteFreq(root, pick(rng, MINOR_PENT));
    if (rng() < 0.3) bass[i + 2] = noteFreq(root, pick(rng, MINOR_PENT));
  }
  for (let i = 0; i < 32; i++) {
    if (rng() < 0.12) lead[i] = noteFreq(root * 4, pick(rng, MINOR_PENT));
  }
  return { kicks, snares, hats, bass, lead, bpm: 88 + Math.floor(rng() * 10) };
}

export function playBeat(seed) {
  if (!ac) return;
  stopBeat();
  const pat = makePattern(seed);
  const stepDur = 60 / pat.bpm / 4;
  let step = 0;
  let nextTime = ac.currentTime + 0.05;
  const timer = setInterval(() => {
    if (!ac) return;
    while (nextTime < ac.currentTime + 0.15) {
      const s = step % 32;
      if (pat.kicks[s]) kick(nextTime);
      if (pat.snares[s]) snare(nextTime);
      if (pat.hats[s]) hat(nextTime, pat.hats[s] === 2);
      if (pat.bass[s]) square(nextTime, pat.bass[s], stepDur * 1.8, 0.14);
      if (pat.lead[s]) square(nextTime, pat.lead[s], stepDur * 0.9, 0.05);
      nextTime += stepDur;
      step++;
    }
  }, 60);
  beat = { timer };
}

export function stopBeat() {
  if (beat) { clearInterval(beat.timer); beat = null; }
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
