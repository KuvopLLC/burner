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
  spiral: [
    '.XXXX..',
    'XX..XX.',
    'X..X.X.',
    'X.XX.X.',
    'X....X.',
    '.XXXX..',
  ],
  copyright: [
    '.XXX.',
    'X...X',
    'X.XX.',
    'X.X..',
    'X.XX.',
    'X...X',
    '.XXX.',
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

export function makePiece(tag, seed, partnerTag = null, forceWord = null) {
  const rng = makeRng(seed);
  const w = PIECE_W, h = PIECE_H;

  // 0. Tonight's subject + decorations
  let word = tag;
  const roll = rng();
  if (forceWord) word = forceWord;
  else if (partnerTag && roll < 0.15) word = partnerTag;
  else if (roll < 0.45) word = pick(rng, WORDS);
  const animal = !forceWord && rng() < 0.35 ? pick(rng, ANIMALS) : null;
  const animalSide = rng() < 0.5 ? -1 : 1;
  const hasCrown = rng() < 0.45;
  const hasArrows = !animal && !forceWord && rng() < 0.4;
  const nStars = Math.floor(rng() * 3) + (hasCrown ? 0 : 1);
  const hasCharm = !animal && rng() < 0.4 ? pick(rng, ['heart', 'bolt', 'spiral', 'copyright']) : null;

  // 1. Render the word as big bouncing letters (5x7 font, scaled fat)
  const [lcv, lc] = makeCanvas(w, h);
  const chars = word.split('');
  const reserve = animal ? 42 : 0;
  // forced words (logos, level cards) overlap less so they stay legible
  const advF = forceWord ? 5.4 : 4.6;
  const s = Math.max(3, Math.min(8, Math.floor((w - 50 - reserve) / (chars.length * advF))));
  const adv = advF * s; // letters overlap a touch, graffiti style
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

  // 1c. Roll tonight's style — the blackbook is deep
  const style = {
    form: forceWord ? 'block' : pick(rng, ['block', 'block', 'bubble', 'bubble', 'lean']),
    lean: !forceWord && rng() < 0.3 ? (rng() < 0.5 ? 1 : -1) : 0,
    threeD: pick(rng, ['extrude', 'extrude', 'drop']), // every piece keeps a real shadow region
    fill: pick(rng, ['fade', 'fade', 'splitcap', 'crackle']),
    outline: rng() < 0.4 ? 'keyline' : 'single',
    bg: pick(rng, ['cloud', 'cloud', 'splash', 'burst']),
    bits: !forceWord && rng() < 0.5,
    fusedArrows: !forceWord && !hasArrows && rng() < 0.45,
    drips: rng() < 0.5,
  };

  // 2. Letter mask
  const img = lc.getImageData(0, 0, w, h).data;
  let letters = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (img[i * 4 + 3] > 0) letters[i] = 1;
  // lean: shear the whole word like it's mid-stride
  if (style.lean) {
    const sheared = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const off = Math.round((h / 2 - y) * 0.22 * style.lean);
      for (let x = 0; x < w; x++) {
        if (!letters[y * w + x]) continue;
        const nx = x + off;
        if (nx >= 0 && nx < w) sheared[y * w + nx] = 1;
      }
    }
    letters = sheared;
  }
  letters = dilate(letters, w, h, style.form === 'bubble' ? 2 : 1);

  // 2b. bits: stair-step notches and slice cuts through the bars
  if (style.bits) {
    for (let n = 0; n < 3 + Math.floor(rng() * 3); n++) {
      // find a letter pixel to chip at
      let idx = -1;
      for (let tries = 0; tries < 60; tries++) {
        const cand = Math.floor(rng() * w * h);
        if (letters[cand]) { idx = cand; break; }
      }
      if (idx < 0) break;
      const bx = idx % w, by = Math.floor(idx / w);
      if (rng() < 0.5) {
        // stair bit: two stacked notches
        for (let sx = 0; sx < 3; sx++) for (let sy = 0; sy < 3; sy++) {
          const i2 = (by + sy) * w + bx + sx;
          if (bx + sx < w && by + sy < h) letters[i2] = 0;
        }
        for (let sx = 0; sx < 3; sx++) for (let sy = 0; sy < 3; sy++) {
          const i2 = (by + 3 + sy) * w + bx + 3 + sx;
          if (bx + 3 + sx < w && by + 3 + sy < h) letters[i2] = 0;
        }
      } else {
        // slice: a thin diagonal cut
        for (let k = -5; k <= 5; k++) {
          const cx2 = bx + k, cy2 = by - k;
          if (cx2 >= 0 && cx2 < w && cy2 >= 0 && cy2 < h) {
            letters[cy2 * w + cx2] = 0;
            if (cx2 + 1 < w) letters[cy2 * w + cx2 + 1] = 0;
          }
        }
      }
    }
  }

  // 2c. fused arrow terminals: the letterform becomes the lightning
  if (style.fusedArrows) {
    for (const side of [-1, 1]) {
      // find the extreme letter pixel around mid-height
      const rows = [Math.floor(h / 2 - 8), Math.floor(h / 2), Math.floor(h / 2 + 8)];
      let ex = side === 1 ? -1 : w;
      let ey = h / 2;
      for (const ry of rows) {
        for (let x = 0; x < w; x++) {
          const xx = side === 1 ? w - 1 - x : x;
          if (letters[ry * w + xx]) {
            if ((side === 1 && xx > ex) || (side === -1 && xx < ex)) { ex = xx; ey = ry; }
            break;
          }
        }
      }
      if (ex < 0 || ex >= w) continue;
      // stamp a solid arrowhead pointing outward
      for (let ax = 0; ax < 9; ax++) {
        const spread = 9 - ax;
        for (let ay = -spread; ay <= spread; ay++) {
          const px2 = ex + side * (ax + 1), py2 = Math.round(ey) + ay;
          if (px2 >= 2 && px2 < w - 2 && py2 >= 2 && py2 < h - 2) letters[py2 * w + px2] = 1;
        }
      }
    }
  }

  // 2d. drips: paint obeys gravity
  if (style.drips) {
    for (let n = 0; n < 2 + Math.floor(rng() * 3); n++) {
      const dx2 = Math.floor(w * 0.25 + rng() * w * 0.5);
      // find bottom edge of letters at this column
      let bottom = -1;
      for (let y = h - 1; y >= 0; y--) { if (letters[y * w + dx2]) { bottom = y; break; } }
      if (bottom < 0 || bottom > h - 6) continue;
      const len = 5 + Math.floor(rng() * 9);
      for (let k = 0; k < len && bottom + k < h - 2; k++) {
        letters[(bottom + k) * w + dx2] = 1;
        letters[(bottom + k) * w + dx2 + 1] = 1;
      }
      // the drop bead
      if (bottom + len < h - 3) {
        for (let bx2 = -1; bx2 <= 2; bx2++) letters[(bottom + len) * w + dx2 + bx2] = 1;
      }
    }
  }

  // 3. Derived masks
  const outlined = dilate(letters, w, h, 2);
  let shadow;
  if (style.threeD === 'extrude') {
    // solid 3D depth, Style 101: the union of diagonal shifts
    shadow = new Uint8Array(w * h);
    for (let d = 1; d <= 5; d++) {
      const sh = shift(outlined, w, h, d, d);
      for (let i = 0; i < w * h; i++) if (sh[i]) shadow[i] = 1;
    }
  } else {
    shadow = shift(outlined, w, h, 3, 3);
  }
  // background: cloud, organic splash, or a spiky burst
  let cloud;
  if (style.bg === 'splash') {
    cloud = dilate(letters, w, h, 6);
    const more = dilate(cloud, w, h, 5);
    for (let i = 0; i < w * h; i++) {
      const x = i % w, y = Math.floor(i / w);
      const nz = ((Math.imul(x >> 3, 2654435761) ^ Math.imul(y >> 3, 40503) ^ seed) >>> 8) % 5;
      if (more[i] && nz < 2) cloud[i] = 1;
    }
  } else if (style.bg === 'burst') {
    cloud = dilate(letters, w, h, 4);
    // rays out from the center
    const cx2 = w / 2, cy2 = h / 2;
    for (let a = 0; a < 14; a++) {
      const ang = (a / 14) * 6.283 + rng() * 0.3;
      const rl = 26 + rng() * 22;
      for (let t = 8; t < rl; t++) {
        const px2 = Math.round(cx2 + Math.cos(ang) * t * 1.9);
        const py2 = Math.round(cy2 + Math.sin(ang) * t * 0.75);
        for (let ww2 = -1; ww2 <= 1; ww2++) {
          const i2 = (py2 + ww2) * w + px2;
          if (px2 >= 2 && px2 < w - 2 && py2 + ww2 >= 2 && py2 + ww2 < h - 2) cloud[i2] = 1;
        }
      }
    }
  } else {
    cloud = dilate(letters, w, h, 8);
  }

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

  // 6. Pixel counts + vertical bounds per region (coverage + fades)
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const regBounds = {};
  for (let i = 0; i < w * h; i++) {
    const r = regions[i];
    if (!r) continue;
    counts[r]++;
    const y = Math.floor(i / w);
    const b = regBounds[r] || (regBounds[r] = { minY: y, maxY: y });
    if (y < b.minY) b.minY = y;
    if (y > b.maxY) b.maxY = y;
  }

  // keyline ring: the outermost skin of the outline region, for the
  // DOVE-style second outline glow
  const ring = new Uint8Array(w * h);
  if (style.outline === 'keyline') {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (regions[i] !== R_OUTLINE) continue;
        const n1 = regions[i - 1], n2 = regions[i + 1], n3 = regions[i - w], n4 = regions[i + w];
        if (n1 !== R_OUTLINE && n1 !== R_FILL_A && n1 !== R_FILL_B) ring[i] = 1;
        else if (n2 !== R_OUTLINE && n2 !== R_FILL_A && n2 !== R_FILL_B) ring[i] = 1;
        else if (n3 !== R_OUTLINE && n3 !== R_FILL_A && n3 !== R_FILL_B) ring[i] = 1;
        else if (n4 !== R_OUTLINE && n4 !== R_FILL_A && n4 !== R_FILL_B) ring[i] = 1;
      }
    }
  }

  return { tag, word, seed, w, h, regions, palette, counts, regBounds, style, ring };
}

// ---- Fades ---------------------------------------------------------------
// Real pieces aren't flat: fills FADE from light to dark down the
// letters, dithered like a fat cap laying a gradient. The ghost, the
// paint you spray, and the final render all share this shading.

const shadeCache = new Map();

function shadeHex(hex, f) {
  const key = hex + f;
  let v = shadeCache.get(key);
  if (v) return v;
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const m = ch => Math.round(f > 0 ? ch + (255 - ch) * f : ch * (1 + f));
  v = '#' + [m(r), m(g), m(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  shadeCache.set(key, v);
  return v;
}

// style-aware shading: fades, split caps, crackle, keylines — all
// derived from the five can colors so the ghost, the sprayed paint,
// and the book polaroid agree.
export function pieceShade(piece, rid, x, y) {
  const hex = piece.palette[rid].hex;
  const st = piece.style || {};
  const i = y * piece.w + x;

  if (rid === 3) {
    // keyline: the outer skin of the outline glows light
    if (st.outline === 'keyline' && piece.ring && piece.ring[i]) return shadeHex(hex, 0.72);
    return hex;
  }
  if (rid === 4) {
    // extruded 3D reads deeper toward the bottom
    if (st.threeD === 'extrude') {
      const b4 = piece.regBounds[4];
      if (b4 && b4.maxY > b4.minY && (y - b4.minY) / (b4.maxY - b4.minY) > 0.5) return shadeHex(hex, -0.3);
    }
    return hex;
  }

  const b = piece.regBounds[rid];
  if (!b || b.maxY <= b.minY) return hex;
  const t = (y - b.minY) / (b.maxY - b.minY);

  if ((rid === 1 || rid === 2) && st.fill === 'crackle') {
    // DOVE cracks: connected dark veins wandering through the fill
    const ph = (piece.seed % 7) * 0.9;
    const v1 = Math.sin(x * 0.42 + y * 0.83 + ph);
    const v2 = Math.sin(x * 0.19 - y * 0.57 + ph * 1.7);
    if (v1 > 0.94 || v2 > 0.96) return shadeHex(hex, -0.5);
  }
  if ((rid === 1 || rid === 2) && st.fill === 'splitcap' && t < 0.3) {
    return shadeHex(hex, 0.45); // City-Soup cap band
  }

  let v = t;
  const dith = ((x & 1) + ((y & 1) << 1)) / 4;
  v += (dith - 0.375) * 0.34;
  const f = rid === 5 ? 0.10 : 0.24;
  if (v < 0.34) return shadeHex(hex, f);
  if (v < 0.67) return hex;
  return shadeHex(hex, -f * 0.85);
}

// Full-color render of a piece (ghost, partner samples, name preview)
export function renderPiece(piece) {
  const [cv, c] = makeCanvas(piece.w, piece.h);
  const img = c.createImageData(piece.w, piece.h);
  const d = img.data;
  const rgbCache = new Map();
  for (let i = 0; i < piece.w * piece.h; i++) {
    const r = piece.regions[i];
    if (!r) continue;
    const hex = pieceShade(piece, r, i % piece.w, Math.floor(i / piece.w));
    let rgb = rgbCache.get(hex);
    if (!rgb) {
      rgb = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
      rgbCache.set(hex, rgb);
    }
    d[i * 4] = rgb[0]; d[i * 4 + 1] = rgb[1]; d[i * 4 + 2] = rgb[2];
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


// A writer kid, 20x30: fitted cap with top shine and a real brim, eye
// whites, cheek shading, a linked rope chain with a hanging medallion,
// striped top with side shading, track pants, shell-toes with flared
// soles. Facing right.
const KID = [
  '......OOOOOOO.......',
  '....OOCLLLLLCOO.....',
  '...OCLLCCCCCCCCO....',
  '..OCCLCCCCCCCCCO....',
  '..OCCCCCCCCCCCCOOO..',
  '..ODDDDDDDDDDDDCCCO.',
  '..OSSSSSSSSSSSSOOOO.',
  '..OSSSSSSSSSSSSO....',
  '..OSFFESSSSFFESO....',
  '..OSSSSSSSSSSSSO....',
  '..OKSSSSSSSSSSSO....',
  '...OKSSSSSSSSKO.....',
  '....OOSSSSSSOO......',
  '...OGYGGYGGYGGO.....',
  '..OHHOGGGGGGOHHO....',
  '.OHHHHOGYGOHHHHHO...',
  '.OHHHHHOOOHHHHHHO...',
  '.OWWWWWWWWWWWWWWO...',
  '.OHHHHHHHHHHHHHHO...',
  '.OIHHHHHHHHHHHHIO...',
  '.OIHHHHHHHHHHHHIO...',
  '.OSIHHHHHHHHHHISO...',
  '..OOPPPPPPPPPPOO....',
  '...OPPPPO..OPPPPO...',
  '...OPQPPO..OPQPPO...',
  '...OPQPPO..OPQPPO...',
  '...OPQPPO..OPQPPO...',
  '...OTTTTO..OTTTTO...',
  '..OTTTTTTOOTTTTTTO..',
  '..OUUUUUUO.OUUUUUUO.',
];

const KID_STRIDE = [
  '..OPPPPO....OPPPPO..',
  '..OPQPPO....OPQPPO..',
  '..OPQPPO....OPQPPO..',
  '..OPQPPO....OPQPPO..',
  '..OTTTTO....OTTTTO..',
  '.OTTTTTTO..OTTTTTTO.',
  '.OUUUUUUO..OUUUUUUO.',
];

const KID_BLINK = '..OSKKSSSSKKSSSO....';

export function makeKid(seed, hue) {
  const rng = makeRng(seed);
  const [skin, skinDark] = pick(rng, SKIN_TONES);
  const capHue = rng() < 0.45 ? hue : (hue + 140 + rng() * 80) % 360;
  const striped = rng() < 0.65;
  const topMain = hsl(hue, 60, 42);
  return makeFrames(KID, {
    O: '#171310',
    C: hsl(capHue, 72, 46), D: hsl(capHue, 72, 28), L: hsl(capHue, 72, 62),
    S: skin, K: skinDark, E: '#180f0a', F: '#ece6d8',
    G: '#e0b02c', Y: '#f8dc6a',
    H: topMain, I: hsl(hue, 60, 26),
    W: striped ? '#f0f0ea' : topMain,
    P: '#262a34', Q: '#e8e8e8',
    T: '#f2f2ec', U: '#22201a',
  }, { eyeRow: 8, eyeClosed: KID_BLINK, legStart: 23, legRows: KID_STRIDE });
}

// Beat cop, 20x30: peaked cap with a full visor, cap + chest badges,
// duty belt with the buckle catching light.
const COP = [
  '....OOOOOOOOOOO.....',
  '...OBRBBBBBBBBBO....',
  '..OBBBGBBBBBBBBO....',
  '..OOOOOOOOOOOOOOOO..',
  '...OSSSSSSSSSSSO....',
  '...OSSSSSSSSSSSO....',
  '...OSFFESSSFFESO....',
  '...OSSSSSSSSSSSO....',
  '...OKSSSSSSSSSSO....',
  '....OKSSSSSSSKO.....',
  '.....OOSSSSOO.......',
  '....OBBBBBBBBO......',
  '..OBBBBBBBBBBBBO....',
  '.OBBBBGBBBBBBBBBO...',
  '.OBBBBBBBBBBBBBBO...',
  '.OBBBBBBBBBBBBBBO...',
  '.OIBBBBBBBBBBBBIO...',
  '.OIBBBBBBBBBBBBIO...',
  '.OSIBBBBBBBBBBISO...',
  '..OOUUUYGUUUUUOO....',
  '...OMMMMO..OMMMMO...',
  '...OMMMMO..OMMMMO...',
  '...OMMMMO..OMMMMO...',
  '...OMMMMO..OMMMMO...',
  '...OMMMMO..OMMMMO...',
  '...OMMMMO..OMMMMO...',
  '...OUUUUO..OUUUUO...',
  '..OUUUUUUOOUUUUUUO..',
  '..OUUUUUUO.OUUUUUUO.',
  '....................',
];

const COP_STRIDE = [
  '..OMMMMO....OMMMMO..',
  '..OMMMMO....OMMMMO..',
  '..OMMMMO....OMMMMO..',
  '..OMMMMO....OMMMMO..',
  '..OMMMMO....OMMMMO..',
  '..OMMMMO....OMMMMO..',
  '..OUUUUO....OUUUUO..',
  '.OUUUUUUO..OUUUUUUO.',
  '.OUUUUUUO..OUUUUUUO.',
  '....................',
];

const COP_BLINK = '...OSKKSSSKKSSSO....';

export function makeCop(seed) {
  const rng = makeRng(seed);
  const [skin, skinDark] = pick(rng, SKIN_TONES.concat([['#e0b088', '#c09068']]));
  return makeFrames(COP, {
    O: '#0c0e14',
    B: '#25356e', I: '#1a2650', M: '#1c2a55', R: '#3a4a86',
    G: '#f0c040', Y: '#f8dc6a',
    S: skin, K: skinDark, E: '#180f0a', F: '#ece6d8',
    U: '#16141a',
  }, { eyeRow: 6, eyeClosed: COP_BLINK, legStart: 20, legRows: COP_STRIDE });
}

// Yard security: same cut, grayer coat, big flashlight habit.
export function makeGuard(seed) {
  const rng = makeRng(seed);
  const [skin, skinDark] = pick(rng, SKIN_TONES.concat([['#e0b088', '#c09068']]));
  return makeFrames(COP, {
    O: '#0c0e14',
    B: '#3d4048', I: '#2c2f36', M: '#33363e', R: '#4c5058',
    G: '#c8c8d0', Y: '#e8e8f0',
    S: skin, K: skinDark, E: '#180f0a', F: '#ece6d8',
    U: '#16141a',
  }, { eyeRow: 6, eyeClosed: COP_BLINK, legStart: 20, legRows: COP_STRIDE });
}

// A passer-by, 20x30: hair with a shine line, everyday jacket with a
// zipper, nothing fresh about them.
const PED = [
  '....................',
  '....................',
  '.....OOOOOOOOO......',
  '....OAZAAAAAAAO.....',
  '...OAAASSSSSSAAO....',
  '...OSSSSSSSSSSSO....',
  '...OSFFESSSFFESO....',
  '...OSSSSSSSSSSSO....',
  '...OKSSSSSSSSSKO....',
  '....OKSSSSSSSKO.....',
  '.....OOSSSSOO.......',
  '....OJJJJJJJJO......',
  '..OJJJJJZJJJJJJO....',
  '.OJJJJJJZJJJJJJJO...',
  '.OJJJJJJZJJJJJJJO...',
  '.OJJJJJJZJJJJJJJO...',
  '.OIJJJJJZJJJJJJIO...',
  '.OIJJJJJJJJJJJJIO...',
  '.OSIJJJJJJJJJJISO...',
  '..OOPPPPPPPPPPOO....',
  '...OPPPPO..OPPPPO...',
  '...OPPPPO..OPPPPO...',
  '...OPPPPO..OPPPPO...',
  '...OPPPPO..OPPPPO...',
  '...OPPPPO..OPPPPO...',
  '...OPPPPO..OPPPPO...',
  '...OUUUUO..OUUUUO...',
  '..OUUUUUOO.OUUUUUO..',
  '....................',
  '....................',
];

const PED_STRIDE = [
  '..OPPPPO....OPPPPO..',
  '..OPPPPO....OPPPPO..',
  '..OPPPPO....OPPPPO..',
  '..OPPPPO....OPPPPO..',
  '..OPPPPO....OPPPPO..',
  '..OPPPPO....OPPPPO..',
  '..OUUUUO....OUUUUO..',
  '.OUUUUUO....OUUUUUO.',
  '....................',
  '....................',
];

const PED_BLINK = '...OSKKSSSKKSSSO....';

export function makePedestrian(seed) {
  const rng = makeRng(seed);
  const [skin, skinDark] = pick(rng, SKIN_TONES.concat([['#e0b088', '#c09068']]));
  const jacketHue = Math.floor(rng() * 360);
  return makeFrames(PED, {
    O: '#171310',
    A: pick(rng, ['#2a2018', '#463222', '#181614', '#6a5a4a']),
    Z: '#8a8f98',
    S: skin, K: skinDark, E: '#180f0a', F: '#ece6d8',
    J: hsl(jacketHue, 35, 45), I: hsl(jacketHue, 35, 28),
    P: '#3a3a44',
    U: '#4a3a28',
  }, { eyeRow: 6, eyeClosed: PED_BLINK, legStart: 20, legRows: PED_STRIDE });
}

// Gallery manager: beret, black turtleneck, tan slacks, opinions.
const MGR = PED.slice();
MGR[2] = '....OOOOOOOOOO......';
MGR[3] = '..OBBBBBBBBBBBO.....';
MGR[4] = '...OBBSSSSSSSBO.....';

export function makeManager(seed) {
  const rng = makeRng(seed);
  const [skin, skinDark] = pick(rng, SKIN_TONES.concat([['#e0b088', '#c09068']]));
  return makeFrames(MGR, {
    O: '#171310',
    B: '#22222a',
    Z: '#3a3a44',
    S: skin, K: skinDark, E: '#180f0a', F: '#ece6d8',
    J: '#1f1f26', I: '#141419',
    P: '#9a8a68',
    U: '#3a2c1e',
  }, { eyeRow: 6, eyeClosed: PED_BLINK, legStart: 20, legRows: PED_STRIDE });
}

// Yard dog, 24x14: lean, ears up, red eye, collar, tail high. Facing
// left; flip at draw time for the other direction.
const DOG = [
  '...OO...................',
  '..ODDO.............OO...',
  '..ODDDO...........ODDO..',
  '.ODDDDDO..........ODDO..',
  '.ODEDDDO.........ODDO...',
  '.ONDDDDOOOOOOOOOODDO....',
  '..ODDCDDDDDDDDDDDDO.....',
  '..OODCDDDDDDDDDDDDO.....',
  '...ODDDDDDDDDDDDDO......',
  '...ODDDOODDDDOODDO......',
  '...ODDO..ODDO..ODO......',
  '...ODO...ODO...ODO......',
  '...OO....OO.....OO......',
  '........................',
];

const DOG_STRIDE = [
  '..ODDDO..ODDDO...ODDO...',
  '..ODO......ODO....ODO...',
  '.ODO........ODO....ODO..',
  '.OO..........OO.....OO..',
  '........................',
];

export function makeDog(seed) {
  const rng = makeRng(seed);
  const fur = pick(rng, ['#3a332c', '#5a4426', '#2c2c30']);
  return makeFrames(DOG, {
    O: '#0e0c0a',
    D: fur,
    N: '#0a0908',
    E: '#ff5030',        // that eye catches the streetlight
    C: '#cc2233',        // collar
  }, { legStart: 9, legRows: DOG_STRIDE });
}
