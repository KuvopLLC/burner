// gen.js — procedural pixel art: writer avatars and burner pieces.
// Sprites are drawn from pixel-map templates (one char = one palette key),
// outlined like proper 8-bit art. A "piece" is a region map: each pixel
// belongs to a paint region (fill top, fill bottom, outline, shadow,
// cloud) that wants one color.

import { makeCanvas, text } from './gfx.js';
import { makeRng, pick } from './rng.js';
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

// Decorations stamped into the piece mask — they get fills, outline,
// shadow, and cloud exactly like the letters do, so crowns and critters
// read as part of the burner.
const MOTIFS = {
  crown: [
    'X....X....X',
    'X...XXX...X',
    'XX..XXX..XX',
    'XXXXXXXXXXX',
    '.XXXXXXXXX.',
  ],
  star: [
    '...X...',
    '..XXX..',
    'XXXXXXX',
    '.XXXXX.',
    '.XX.XX.',
    'X.....X',
  ],
  arrow: [
    '........X..',
    '.........X.',
    'XXXXXXXXXXX',
    '.........X.',
    '........X..',
  ],
  heart: [
    '.XX..XX.',
    'XXXXXXXX',
    'XXXXXXXX',
    '.XXXXXX.',
    '..XXXX..',
    '...XX...',
  ],
  bolt: [
    '...XXXX',
    '..XXXX.',
    '.XXXX..',
    'XXXXXXX',
    '..XXXX.',
    '.XXXX..',
    'XXXX...',
    'XX.....',
  ],
  rat: [
    '............XX..',
    '.....XXXXXXXXXX.',
    'XX..XXXXXXXXXXXX',
    '..XXXXXXXXXXXXX.',
    '....XX...XX.....',
  ],
  cat: [
    '.X.X.......X',
    '.XXX.......X',
    '.XXX......XX',
    '..XX......X.',
    '.XXXX....XX.',
    'XXXXXX..XXX.',
    'XXXXXXXXXXX.',
    'XXXXXXXXXX..',
    '.XX..XX.....',
  ],
  pigeon: [
    '....XX......',
    '...XXXX.....',
    '..XXXXXXXXX.',
    '.XXXXXXXXXX.',
    'XXXXXXXXXX..',
    '..XXXXXXX...',
    '....XX..XX..',
  ],
};

const ANIMALS = ['rat', 'cat', 'pigeon'];

// What tonight's piece says — your tag, your partner's, or street talk
const WORDS = [
  'FRESH', 'WILD', 'STYLE', 'BURN', 'DOPE', 'BRONX', 'KING', 'FLY',
  'CRAZY', 'ZOOM', 'BOOM', 'POW', 'REBEL', 'FAME', 'TUFF', 'RAW', 'JAM',
];

function stampMask(c, rows, x0, y0, sc) {
  for (let ry = 0; ry < rows.length; ry++) {
    for (let rx = 0; rx < rows[ry].length; rx++) {
      if (rows[ry][rx] === 'X') c.fillRect(x0 + rx * sc, y0 + ry * sc, sc, sc);
    }
  }
}

export function makePiece(tag, seed, partnerTag = null) {
  const rng = makeRng(seed);
  const w = PIECE_W, h = PIECE_H;

  // 0. Tonight's subject + decorations
  let word = tag;
  const roll = rng();
  if (partnerTag && roll < 0.15) word = partnerTag;
  else if (roll < 0.45) word = pick(rng, WORDS);
  const animal = rng() < 0.35 ? pick(rng, ANIMALS) : null;
  const animalSide = rng() < 0.5 ? -1 : 1;
  const hasCrown = rng() < 0.45;
  const hasArrows = !animal && rng() < 0.4;
  const nStars = Math.floor(rng() * 3) + (hasCrown ? 0 : 1);
  const hasCharm = !animal && rng() < 0.3 ? (rng() < 0.5 ? 'heart' : 'bolt') : null;

  // 1. Render the word as big bouncing letters (5x7 font, scaled fat)
  const [lcv, lc] = makeCanvas(w, h);
  const chars = word.split('');
  const reserve = animal ? 42 : 0;
  const s = Math.max(3, Math.min(8, Math.floor((w - 50 - reserve) / (chars.length * 4.6))));
  const adv = 4.6 * s; // letters overlap a touch, graffiti style
  const total = adv * (chars.length - 1) + 5 * s;
  let x = (w - total) / 2 - animalSide * (reserve / 2);
  const startX = x;
  const yBase = h / 2 - 3.5 * s;
  const bounce = rng() * 6.28;
  for (let i = 0; i < chars.length; i++) {
    const wob = Math.sin(bounce + i * 1.9) * s * 0.7;
    text(lc, chars[i], x, yBase + wob, '#fff', s);
    x += adv;
  }
  const endX = x - adv + 5 * s;

  // 1b. Stamp the whimsy into the same mask
  lc.fillStyle = '#fff';
  const clampX = (v, mw) => Math.max(10, Math.min(w - 10 - mw, Math.round(v)));
  const clampY = (v, mh) => Math.max(10, Math.min(h - 10 - mh, Math.round(v)));
  if (animal) {
    const rows = MOTIFS[animal], sc = 2;
    const mw = rows[0].length * sc, mh = rows.length * sc;
    const ax = animalSide === 1 ? endX + 8 : startX - mw - 8;
    stampMask(lc, rows, clampX(ax, mw), clampY(yBase + 7 * s - mh, mh), sc);
  }
  if (hasCrown) {
    const rows = MOTIFS.crown, sc = 2;
    const mw = rows[0].length * sc, mh = rows.length * sc;
    const cx = startX + rng() * Math.max(1, (endX - startX) - mw);
    stampMask(lc, rows, clampX(cx, mw), clampY(yBase - mh + 2, mh), sc);
  }
  if (hasArrows) {
    const rows = MOTIFS.arrow, sc = 2;
    const mw = rows[0].length * sc, mh = rows.length * sc;
    const ay = yBase + 3.5 * s - mh / 2;
    stampMask(lc, rows, clampX(endX - 2, mw), clampY(ay, mh), sc);
    // mirrored on the left
    const [mcv, mc] = makeCanvas(mw, mh);
    mc.fillStyle = '#fff';
    stampMask(mc, rows, 0, 0, sc);
    lc.save();
    lc.translate(clampX(startX - mw + 2, mw) + mw, clampY(ay, mh));
    lc.scale(-1, 1);
    lc.drawImage(mcv, 0, 0);
    lc.restore();
  }
  if (hasCharm) {
    const rows = MOTIFS[hasCharm], sc = 2;
    const mw = rows[0].length * sc, mh = rows.length * sc;
    const side = rng() < 0.5 ? -1 : 1;
    const hx = side === 1 ? endX + 6 : startX - mw - 6;
    stampMask(lc, rows, clampX(hx, mw), clampY(yBase - mh / 2 + rng() * 20, mh), sc);
  }
  for (let n = 0; n < nStars; n++) {
    const rows = MOTIFS.star, sc = rng() < 0.5 ? 1 : 2;
    const mw = rows[0].length * sc, mh = rows.length * sc;
    const sx = 14 + rng() * (w - 28 - mw);
    const sy = rng() < 0.5 ? yBase - mh - 2 - rng() * 8 : yBase + 7 * s + 2 + rng() * 6;
    stampMask(lc, rows, clampX(sx, mw), clampY(sy, mh), sc);
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

  return { tag, word, seed, w, h, regions, palette, counts };
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

// Render a pixel-map template. Each char indexes the palette; '.' is
// transparent.
function renderSprite(rows, palette) {
  const w = rows[0].length, h = rows.length;
  const [cv, c] = makeCanvas(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = rows[y][x];
      if (k === '.') continue;
      c.fillStyle = palette[k];
      c.fillRect(x, y, 1, 1);
    }
  }
  return cv;
}

const SKIN_TONES = [
  ['#a06a42', '#7d4f2e'], ['#7a4a28', '#5c3419'], ['#c98e5a', '#a06a3e'],
  ['#5f3a1e', '#452811'], ['#b57a48', '#8f5a30'],
];

// Frame builder: every character gets a blink frame (eyes shut for a
// tick) and a stride frame (legs apart) so the world breathes.
// Returns { idle: [open, blink], walk: [stand, stride] }.
function makeFrames(rows, palette, { eyeRow, eyeClosed, legStart, legRows } = {}) {
  const norm = renderSprite(rows, palette);
  let blink = norm, stride = norm;
  if (eyeRow != null) {
    const r = rows.slice();
    r[eyeRow] = eyeClosed;
    blink = renderSprite(r, palette);
  }
  if (legRows) {
    const r = rows.slice();
    legRows.forEach((row, k) => { r[legStart + k] = row; });
    stride = renderSprite(r, palette);
  }
  return { idle: [norm, blink], walk: [norm, stride], w: rows[0].length, h: rows.length };
}

// A writer kid: sideways cap, striped top, gold rope chain, shell-toes.
// 16x24, facing right (brim side).
const KID = [
  '.....OOOOO......',
  '...OOCCCCCOO....',
  '..OCCCCCCCCCO...',
  '..OCCCCCCCCCOOO.',
  '..ODDDDDDDDDCCO.',
  '..OSSSSSSSSSOOO.',
  '..OSSSSSSSSSO...',
  '..OSFESSSFESO...',
  '..OSSSSSSSSSO...',
  '..OKKSSSSSKKO...',
  '...OOSSSSSOO....',
  '..OOGGGGGGGOO...',
  '.OHHOGGGGGOHHO..',
  '.OHHHHHHHHHHHO..',
  '.OWWWWWWWWWWWO..',
  '.OHHHHHHHHHHHO..',
  '.OIHHHHHHHHHIO..',
  '.OSIHHHHHHHISO..',
  '..OOPPPPPPPOO...',
  '..OPPPO.OPPPO...',
  '..OPQPO.OPQPO...',
  '..OPQPO.OPQPO...',
  '..OTTTO.OTTTO...',
  '.OUUUUO.OUUUUO..',
];

const KID_STRIDE = [
  '.OPPPO...OPPPO..',
  '.OPQPO...OPQPO..',
  '.OPQPO...OPQPO..',
  '.OTTTO...OTTTO..',
  'OUUUUO...OUUUUO.',
];

export function makeKid(seed, hue) {
  const rng = makeRng(seed);
  const [skin, skinDark] = pick(rng, SKIN_TONES);
  const capHue = rng() < 0.45 ? hue : (hue + 140 + rng() * 80) % 360;
  const striped = rng() < 0.65;
  const topMain = hsl(hue, 60, 42);
  return makeFrames(KID, {
    O: '#14100c',
    C: hsl(capHue, 72, 46), D: hsl(capHue, 72, 30),
    S: skin, K: skinDark, E: '#180f0a', F: '#e8e2d4',
    G: '#f0c040',
    H: topMain, I: hsl(hue, 60, 28),
    W: striped ? '#f0f0ea' : topMain,
    P: '#262a34', Q: '#e8e8e8',
    T: '#f2f2ec', U: '#26221c',
  }, { eyeRow: 7, eyeClosed: '..OSKKSSSKKSO...', legStart: 19, legRows: KID_STRIDE });
}

// Beat cop: peaked cap with visor, navy uniform, badge, duty belt.
const COP = [
  '................',
  '...OOOOOOOOO....',
  '..OBBBBBBBBBO...',
  '..OBBGBBBBBBO...',
  '..OOOOOOOOOOOO..',
  '..OSSSSSSSSSO...',
  '..OSSSSSSSSSO...',
  '..OSFESSSFESO...',
  '..OSSSSSSSSSO...',
  '..OKSSSSSSSKO...',
  '...OOSSSSSOO....',
  '..OBBBBBBBBBOO..',
  '.OBBBBBBBBBBBO..',
  '.OBBGBBBBBBBBO..',
  '.OBBBBBBBBBBBO..',
  '.OBBBBBBBBBBBO..',
  '.OIBBBBBBBBBIO..',
  '.OSIBBBBBBBISO..',
  '..OUUUGGUUUOO...',
  '..OMMMO.OMMMO...',
  '..OMMMO.OMMMO...',
  '..OMMMO.OMMMO...',
  '..OUUUO.OUUUO...',
  '.OUUUUO.OUUUUO..',
];

const COP_STRIDE = [
  '.OMMMO...OMMMO..',
  '.OMMMO...OMMMO..',
  '.OMMMO...OMMMO..',
  '.OUUUO...OUUUO..',
  'OUUUUO...OUUUUO.',
];

export function makeCop(seed) {
  const rng = makeRng(seed);
  const [skin, skinDark] = pick(rng, SKIN_TONES.concat([['#e0b088', '#c09068']]));
  return makeFrames(COP, {
    O: '#0c0e14',
    B: '#25356e', I: '#1a2650', M: '#1c2a55',
    G: '#f0c040',
    S: skin, K: skinDark, E: '#180f0a', F: '#e8e2d4',
    U: '#16141a',
  }, { eyeRow: 7, eyeClosed: '..OSKKSSSKKSO...', legStart: 19, legRows: COP_STRIDE });
}

// Yard security: same cut as the beat cop, grayer coat, big flashlight
// habit. Ambience — he hasn't seen you. Yet.
export function makeGuard(seed) {
  const rng = makeRng(seed);
  const [skin, skinDark] = pick(rng, SKIN_TONES.concat([['#e0b088', '#c09068']]));
  return makeFrames(COP, {
    O: '#0c0e14',
    B: '#3d4048', I: '#2c2f36', M: '#33363e',
    G: '#c8c8d0',
    S: skin, K: skinDark, E: '#180f0a', F: '#e8e2d4',
    U: '#16141a',
  }, { eyeRow: 7, eyeClosed: '..OSKKSSSKKSO...', legStart: 19, legRows: COP_STRIDE });
}

// A passer-by: random hair and jacket, nothing fresh about them.
const PED = [
  '................',
  '................',
  '................',
  '....OOOOOO......',
  '...OAAAAAAO.....',
  '..OASSSSSSAO....',
  '..OSSSSSSSSO....',
  '..OSFESSFESO....',
  '..OSSSSSSSSO....',
  '..OKSSSSSSKO....',
  '...OOSSSSOO.....',
  '..OJJJJJJJJOO...',
  '.OJJJJJJJJJJJO..',
  '.OJJJJJJJJJJJO..',
  '.OJJJJJJJJJJJO..',
  '.OIJJJJJJJJJIO..',
  '.OSIJJJJJJJISO..',
  '..OOPPPPPPPOO...',
  '..OPPPO.OPPPO...',
  '..OPPPO.OPPPO...',
  '..OPPPO.OPPPO...',
  '..OPPPO.OPPPO...',
  '..OUUUO.OUUUO...',
  '.OUUUUO.OUUUUO..',
];

// Yard dog, running left. Flip at draw time for the other direction.
const DOG = [
  '..OO..............',
  '.ODDO.............',
  'ODDDDO.........OO.',
  'ODEDDO........ODDO',
  '.OODDOOOOOOOOODDO.',
  '..ODDDDDDDDDDDDO..',
  '..OCDDDDDDDDDDO...',
  '...ODDO..ODDO.....',
  '...ODO....ODO.....',
  '...OO......OO.....',
];

const DOG_STRIDE = [
  '..ODDO....ODDO....',
  '..ODO......ODO....',
  '..OO........OO....',
];

export function makeDog(seed) {
  const rng = makeRng(seed);
  const fur = pick(rng, ['#3a332c', '#5a4426', '#2c2c30']);
  return makeFrames(DOG, {
    O: '#0e0c0a',
    D: fur,
    E: '#ff5030',        // that eye catches the streetlight
    C: '#cc2233',        // collar
  }, { legStart: 7, legRows: DOG_STRIDE });
}

const PED_STRIDE = [
  '.OPPPO...OPPPO..',
  '.OPPPO...OPPPO..',
  '.OPPPO...OPPPO..',
  '.OPPPO...OPPPO..',
  '.OUUUO...OUUUO..',
  'OUUUUO...OUUUUO.',
];

export function makePedestrian(seed) {
  const rng = makeRng(seed);
  const [skin, skinDark] = pick(rng, SKIN_TONES.concat([['#e0b088', '#c09068']]));
  const jacketHue = Math.floor(rng() * 360);
  return makeFrames(PED, {
    O: '#14100c',
    A: pick(rng, ['#2a2018', '#463222', '#181614', '#6a5a4a']),
    S: skin, K: skinDark, E: '#180f0a', F: '#e8e2d4',
    J: hsl(jacketHue, 35, 45), I: hsl(jacketHue, 35, 30),
    P: '#3a3a44',
    U: '#4a3a28',
  }, { eyeRow: 7, eyeClosed: '..OSKKSSKKSO....', legStart: 18, legRows: PED_STRIDE });
}

// Gallery manager: beret, black turtleneck, tan slacks, opinions.
const MGR = PED.slice();
MGR[3] = '...OBBBBBBBO....';
MGR[4] = '..OBBBBBBBBBO...';
MGR[5] = '..OSSSSSSSSO....';

export function makeManager(seed) {
  const rng = makeRng(seed);
  const [skin, skinDark] = pick(rng, SKIN_TONES.concat([['#e0b088', '#c09068']]));
  return makeFrames(MGR, {
    O: '#14100c',
    B: '#22222a',
    S: skin, K: skinDark, E: '#180f0a', F: '#e8e2d4',
    J: '#1f1f26', I: '#15151a',
    P: '#9a8a68',
    U: '#3a2c1e',
  }, { eyeRow: 7, eyeClosed: '..OSKKSSKKSO....', legStart: 18, legRows: PED_STRIDE });
}
