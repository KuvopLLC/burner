// gen.js — procedural pixel art: writer avatars and burner pieces.
// A "piece" is a region map: each pixel belongs to a paint region
// (fill top, fill bottom, outline, shadow, cloud) that wants one color.

import { makeCanvas, text, textWidth } from './gfx.js';
import { makeRng, pick, irange } from './rng.js';
import { COLORS } from './data.js';

export const PIECE_W = 240, PIECE_H = 90;

// Region ids
export const R_FILL_A = 1, R_FILL_B = 2, R_OUTLINE = 3, R_SHADOW = 4, R_CLOUD = 5;

function dilate(src, w, h, passes) {
  let a = src;
  for (let p = 0; p < passes; p++) {
    const b = new Uint8Array(a);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (a[i]) continue;
        if ((x > 0 && a[i - 1]) || (x < w - 1 && a[i + 1]) ||
            (y > 0 && a[i - w]) || (y < h - 1 && a[i + w])) b[i] = 1;
      }
    }
    a = b;
  }
  return a;
}

function shift(src, w, h, dx, dy) {
  const b = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const sy = y - dy;
    if (sy < 0 || sy >= h) continue;
    for (let x = 0; x < w; x++) {
      const sx = x - dx;
      if (sx < 0 || sx >= w) continue;
      if (src[sy * w + sx]) b[y * w + x] = 1;
    }
  }
  return b;
}

export function makePiece(tag, seed) {
  const rng = makeRng(seed);
  const w = PIECE_W, h = PIECE_H;

  // 1. Render the tag as big bouncing letters
  const [lcv, lc] = makeCanvas(w, h);
  const chars = tag.split('');
  const s = Math.max(3, Math.min(6, Math.floor((w - 40) / (chars.length * 6))));
  const advances = chars.map(ch => (textWidth(ch) - 3) * s * 0.85);
  const total = advances.reduce((a, b) => a + b, 0);
  let x = (w - total) / 2;
  const yBase = h / 2 - 5 * s;
  const bounce = rng() * 6.28;
  for (let i = 0; i < chars.length; i++) {
    const wob = Math.sin(bounce + i * 1.9) * s * 0.7;
    text(lc, chars[i], x, yBase + wob, '#fff', s);
    x += advances[i];
  }

  // 2. Letter mask
  const img = lc.getImageData(0, 0, w, h).data;
  let letters = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (img[i * 4 + 3] > 0) letters[i] = 1;
  letters = dilate(letters, w, h, 1); // fatten

  // 3. Derived masks
  const outlined = dilate(letters, w, h, 2);
  const shadow = shift(outlined, w, h, 3, 3);
  const cloud = dilate(letters, w, h, 8);

  // 4. Region map, priority: fill > outline > shadow > cloud
  const regions = new Uint8Array(w * h);
  const wave = rng() * 6.28;
  for (let y = 0; y < h; y++) {
    for (let x2 = 0; x2 < w; x2++) {
      const i = y * w + x2;
      if (letters[i]) {
        const split = h / 2 + Math.sin(wave + x2 / 16) * 6;
        regions[i] = y < split ? R_FILL_A : R_FILL_B;
      } else if (outlined[i]) {
        regions[i] = R_OUTLINE;
      } else if (shadow[i]) {
        regions[i] = R_SHADOW;
      } else if (cloud[i]) {
        regions[i] = R_CLOUD;
      }
    }
  }

  // 5. Palette — 5 distinct colors from the can rack
  const brights = [2, 3, 4, 5, 6, 7];
  const a = pick(rng, brights);
  let b = pick(rng, brights);
  while (b === a) b = pick(rng, brights);
  const outline = rng() < 0.7 ? 1 : 9;   // midnight or cream
  const shadowC = rng() < 0.5 ? 10 : (outline === 1 ? 9 : 1);
  const cloudC = pick(rng, [8, 9].filter(c => c !== shadowC && c !== outline));
  const byId = id => COLORS.find(c => c.id === id);
  const palette = {
    [R_FILL_A]: byId(a), [R_FILL_B]: byId(b), [R_OUTLINE]: byId(outline),
    [R_SHADOW]: byId(shadowC), [R_CLOUD]: byId(cloudC),
  };

  // 6. Pixel counts per region (for coverage math)
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (let i = 0; i < w * h; i++) if (regions[i]) counts[regions[i]]++;

  return { tag, seed, w, h, regions, palette, counts };
}

// Full-color render of a piece (partner samples, finished walls)
export function renderPiece(piece) {
  const [cv, c] = makeCanvas(piece.w, piece.h);
  const img = c.createImageData(piece.w, piece.h);
  const d = img.data;
  for (let i = 0; i < piece.w * piece.h; i++) {
    const r = piece.regions[i];
    if (!r) continue;
    const hex = piece.palette[r].hex;
    d[i * 4] = parseInt(hex.slice(1, 3), 16);
    d[i * 4 + 1] = parseInt(hex.slice(3, 5), 16);
    d[i * 4 + 2] = parseInt(hex.slice(5, 7), 16);
    d[i * 4 + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  return cv;
}

// Pencil-on-paper sketch of a piece: region boundaries on cream
export function renderSketch(piece) {
  const [cv, c] = makeCanvas(piece.w, piece.h);
  c.fillStyle = '#efe9d8';
  c.fillRect(0, 0, piece.w, piece.h);
  const img = c.getImageData(0, 0, piece.w, piece.h);
  const d = img.data, w = piece.w, h = piece.h, rg = piece.regions;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!rg[i]) continue;
      const edge =
        (x > 0 && rg[i - 1] !== rg[i]) || (x < w - 1 && rg[i + 1] !== rg[i]) ||
        (y > 0 && rg[i - w] !== rg[i]) || (y < h - 1 && rg[i + w] !== rg[i]);
      if (edge) {
        d[i * 4] = 70; d[i * 4 + 1] = 66; d[i * 4 + 2] = 60; d[i * 4 + 3] = 255;
      }
    }
  }
  c.putImageData(img, 0, 0);
  return cv;
}

// ---- Sprites ------------------------------------------------------------

function hsl(h, s, l) { return `hsl(${h},${s}%,${l}%)`; }

// A writer kid: sideways cap, hoodie/track suit, gold chain, shell-toes.
// 14x22. facing: 1 = right, -1 = left (brim side).
export function makeKid(seed, hue, facing = 1) {
  const rng = makeRng(seed);
  const skin = pick(rng, ['#8d5a3b', '#6b4226', '#c68e5e', '#5a3620', '#a9714b']);
  const top = hsl(hue, 65, 45);
  const topDark = hsl(hue, 65, 30);
  const capHue = rng() < 0.5 ? hue : (hue + 180) % 360;
  const cap = hsl(capHue, 70, 40);
  const [cv, c] = makeCanvas(14, 22);
  const P = (x, y, w2, h2, col) => { c.fillStyle = col; c.fillRect(x, y, w2, h2); };
  // cap, brim sideways
  P(4, 0, 6, 3, cap);
  if (facing === 1) P(9, 1, 5, 2, cap); else P(0, 1, 5, 2, cap);
  // face
  P(4, 3, 6, 5, skin);
  P(facing === 1 ? 8 : 4, 4, 2, 1, '#1a1010'); // eyes toward facing
  // gold rope chain
  P(4, 8, 6, 1, '#e8c030');
  // hoodie / track top
  P(3, 9, 8, 7, top);
  P(3, 11, 8, 1, '#f0f0f0');       // chest stripe
  P(3, 12, 8, 1, topDark);
  P(2, 9, 1, 5, top); P(11, 9, 1, 5, top); // arms
  P(2, 14, 1, 1, skin); P(11, 14, 1, 1, skin); // hands
  // track pants with side stripe
  P(4, 16, 2, 4, '#20242c'); P(8, 16, 2, 4, '#20242c');
  P(5, 16, 1, 4, '#f0f0f0'); P(9, 16, 1, 4, '#f0f0f0');
  // shell-toes: white, dark stripes, fat toe
  P(3, 20, 4, 2, '#f5f5f0'); P(7, 20, 4, 2, '#f5f5f0');
  P(4, 20, 1, 1, '#333'); P(8, 20, 1, 1, '#333');
  P(3, 21, 4, 1, '#ddd'); P(7, 21, 4, 1, '#ddd');
  return cv;
}

export function makeCop(seed) {
  const rng = makeRng(seed);
  const skin = pick(rng, ['#8d5a3b', '#c68e5e', '#e0b088', '#6b4226']);
  const [cv, c] = makeCanvas(14, 22);
  const P = (x, y, w2, h2, col) => { c.fillStyle = col; c.fillRect(x, y, w2, h2); };
  P(4, 0, 6, 2, '#1a2a5a'); P(3, 2, 8, 1, '#1a2a5a'); // peaked cap
  P(6, 1, 2, 1, '#e8c030');                            // badge
  P(4, 3, 6, 5, skin);
  P(5, 4, 4, 1, '#1a1010');
  P(3, 8, 8, 8, '#24356e');                            // uniform
  P(6, 8, 2, 8, '#1a2650');
  P(2, 8, 1, 6, '#24356e'); P(11, 8, 1, 6, '#24356e');
  P(3, 16, 3, 4, '#1a2650'); P(8, 16, 3, 4, '#1a2650');
  P(3, 20, 4, 2, '#111'); P(7, 20, 4, 2, '#111');
  return cv;
}

export function makePedestrian(seed) {
  const rng = makeRng(seed);
  const skin = pick(rng, ['#8d5a3b', '#c68e5e', '#e0b088', '#6b4226', '#a9714b']);
  const top = hsl(irange(rng, 0, 359), 40, 50);
  const [cv, c] = makeCanvas(14, 22);
  const P = (x, y, w2, h2, col) => { c.fillStyle = col; c.fillRect(x, y, w2, h2); };
  if (rng() < 0.4) P(3, 0, 8, 3, '#3a3230'); // hair or hat
  P(4, 2, 6, 6, skin);
  P(5, 4, 4, 1, '#1a1010');
  P(3, 8, 8, 8, top);
  P(4, 16, 2, 4, '#3a3a44'); P(8, 16, 2, 4, '#3a3a44');
  P(3, 20, 4, 2, '#5a4632'); P(7, 20, 4, 2, '#5a4632');
  return cv;
}
