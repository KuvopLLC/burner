// gfx.js — low-res canvas helpers + pixel text rendered from the
// hand-crafted 5x7 bitmap font in font.js. Tinted strings are cached,
// so all type lands crisp on the pixel grid at any integer scale.

import { glyphRows, GLYPH_W, GLYPH_H, ADVANCE } from './font.js';

export const W = 320, H = 200;

const textCache = new Map();

function renderString(str, color) {
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, str.length * ADVANCE - (ADVANCE - GLYPH_W));
  cv.height = GLYPH_H;
  const c = cv.getContext('2d');
  c.fillStyle = color;
  for (let i = 0; i < str.length; i++) {
    const rows = glyphRows(str[i]);
    for (let ry = 0; ry < GLYPH_H; ry++) {
      const row = rows[ry];
      for (let rx = 0; rx < GLYPH_W; rx++) {
        if (row[rx] === 'X') c.fillRect(i * ADVANCE + rx, ry, 1, 1);
      }
    }
  }
  return cv;
}

function tinted(str, color) {
  const key = str + ' ' + color;
  let cv = textCache.get(key);
  if (!cv) {
    cv = renderString(str, color);
    if (textCache.size > 600) textCache.clear();
    textCache.set(key, cv);
  }
  return cv;
}

export function text(ctx, str, x, y, color = '#fff', scale = 1) {
  if (!str) return 0;
  const cv = tinted(str, color);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cv, Math.round(x), Math.round(y), cv.width * scale, cv.height * scale);
  return cv.width * scale;
}

export function textWidth(str, scale = 1) {
  if (!str) return 0;
  return (str.length * ADVANCE - (ADVANCE - GLYPH_W)) * scale;
}

export function centerText(ctx, str, y, color = '#fff', scale = 1) {
  text(ctx, str, (W - textWidth(str, scale)) / 2, y, color, scale);
}

// arcade text: a hard black drop shadow so type pops off any scene
export function stext(ctx, str, x, y, color = '#fff', scale = 1) {
  text(ctx, str, x + scale, y + scale, '#08080c', scale);
  text(ctx, str, x, y, color, scale);
}

export function scenter(ctx, str, y, color = '#fff', scale = 1) {
  stext(ctx, str, (W - textWidth(str, scale)) / 2, y, color, scale);
}

export function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function frame(ctx, x, y, w, h, color) {
  rect(ctx, x, y, w, 1, color);
  rect(ctx, x, y + h - 1, w, 1, color);
  rect(ctx, x, y, 1, h, color);
  rect(ctx, x + w - 1, y, 1, h, color);
}

export function panel(ctx, x, y, w, h, bg = '#101018', border = '#4a4a6a') {
  rect(ctx, x, y, w, h, bg);
  frame(ctx, x, y, w, h, border);
}

export function meter(ctx, x, y, w, h, frac, fg, bg = '#222', border = '#555') {
  rect(ctx, x, y, w, h, bg);
  rect(ctx, x + 1, y + 1, Math.max(0, (w - 2) * Math.min(1, frac)), h - 2, fg);
  frame(ctx, x, y, w, h, border);
}

export function dither(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  for (let j = 0; j < h; j++)
    for (let i = (j % 2); i < w; i += 2)
      ctx.fillRect(Math.round(x + i), Math.round(y + j), 1, 1);
}

export function makeCanvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  return [cv, c];
}

// Brick wall / subway car / gallery canvas — the surface you paint,
// shared by the paint scene backdrop and the result polaroid.
const LINE_COLORS = { '1': '#ee352e', '2/5': '#ee352e', '4': '#00933c', '6': '#00a65c', 'D': '#ff6319' };

export function drawSurface(ctx, x, y, w, h, kind, rng, line) {
  if (kind === 'train') {
    const lc = LINE_COLORS[line] || '#ee352e';
    // roof + vents
    rect(ctx, x, y, w, 6, '#5c6168');
    for (let i = 0; i < 3; i++) rect(ctx, x + 30 + i * (w / 3), y + 1, 22, 3, '#4c5057');
    // ribbed stainless body
    rect(ctx, x, y + 6, w, 86, '#a9aeb6');
    ctx.fillStyle = '#a0a5ad';
    for (let rx = 4; rx < w; rx += 7) ctx.fillRect(x + rx, y + 6, 1, 86);
    rect(ctx, x, y + 78, w, 14, '#969ba3'); // lower shade
    // window band: windows + two double doors
    rect(ctx, x + 6, y + 14, w - 12, 22, '#171a20');
    const winAt = [14, 96, 136, 216];
    for (const wx of winAt) {
      if (wx + 32 > w - 12) continue;
      for (let k = 0; k < 2; k++) {
        rect(ctx, x + wx + k * 17, y + 16, 14, 18, '#232833');
        rect(ctx, x + wx + k * 17, y + 16, 14, 2, '#39424e'); // night reflection
        frame(ctx, x + wx + k * 17, y + 16, 14, 18, '#3a4048');
      }
    }
    for (const dx of [58, 178]) {
      if (dx + 26 > w) continue;
      rect(ctx, x + dx, y + 14, 26, 66, '#8d939b');            // door leaves
      rect(ctx, x + dx + 12, y + 14, 2, 66, '#5b6068');        // center gap
      rect(ctx, x + dx + 2, y + 16, 9, 16, '#20242e');         // door windows
      rect(ctx, x + dx + 15, y + 16, 9, 16, '#20242e');
    }
    // beltline stripe in the route color, bullet, car number
    rect(ctx, x, y + 38, w, 3, lc);
    ctx.fillStyle = lc;
    for (let dy = -5; dy <= 5; dy++) {
      const ww = Math.round(Math.sqrt(25 - Math.min(25, dy * dy)));
      ctx.fillRect(x + 22 - ww, y + 58 + dy, ww * 2 + 1, 1);
    }
    text(ctx, (line || '2')[0], x + 20, y + 55, '#fff');
    text(ctx, 'N 4721', x + w - 44, y + 56, '#4a5058');
    // skirt + undercarriage with bogies
    rect(ctx, x, y + 92, w, 6, '#3f434a');
    rect(ctx, x, y + 98, w, 8, '#101216');
    for (const bx of [44, w - 72]) {
      rect(ctx, x + bx, y + 98, 30, 5, '#181a20');
      for (const wx of [3, 19]) {
        rect(ctx, x + bx + wx, y + 99, 8, 7, '#1c1e24');
        rect(ctx, x + bx + wx + 3, y + 102, 2, 2, '#3c4048'); // hub
      }
    }
  } else if (kind === 'gallery') {
    rect(ctx, x, y, w, h, '#eae7e0');                  // gallery wall
    rect(ctx, x + 8, y + 4, w - 14, h - 10, '#c9c4b8'); // canvas shadow
    rect(ctx, x + 6, y + 2, w - 14, h - 10, '#f5f2ea'); // stretched canvas
    frame(ctx, x + 6, y + 2, w - 14, h - 10, '#b8ab90');
    rect(ctx, x + w - 14, y + h - 14, 3, 3, '#cc2233'); // red dot. sold.
  } else { // wall
    rect(ctx, x, y, w, h, '#6e4536');
    ctx.fillStyle = '#55322a';
    for (let row = 0; row * 8 < h; row++) {
      const off = (row % 2) * 12;
      for (let col = -1; col * 24 < w + 24; col++) {
        ctx.fillRect(Math.round(x + col * 24 + off), Math.round(y + row * 8), 1, 8);
      }
      ctx.fillRect(Math.round(x), Math.round(y + row * 8), w, 1);
    }
    if (rng) {
      // brick variance, grime, and a couple of cracks
      for (let i = 0; i < 26; i++) {
        const bx = Math.floor(rng() * (w / 24)) * 24 + (Math.floor(rng() * (h / 8)) % 2) * 12;
        const by = Math.floor(rng() * (h / 8)) * 8;
        rect(ctx, x + bx + 1, y + by + 1, 23, 7, rng() < 0.5 ? '#5e392c' : '#7d5040');
      }
      ctx.fillStyle = '#8a5a48';
      for (let i = 0; i < 40; i++) {
        ctx.fillRect(Math.round(x + rng() * w), Math.round(y + rng() * h), 2, 1);
      }
      ctx.fillStyle = '#3a241e';
      for (let c = 0; c < 2; c++) {
        let cx = x + 30 + rng() * (w - 60), cy = y;
        while (cy < y + h - 4) {
          ctx.fillRect(Math.round(cx), Math.round(cy), 1, 3);
          cy += 3; cx += (rng() - 0.5) * 4;
        }
      }
      rect(ctx, x, y + h - 3, w, 3, '#4a2e24'); // grime line at the base
    }
  }
}

// A polaroid: snapshot of a canvas region in a white frame
export function makePolaroid(srcCanvas, sx, sy, sw, sh) {
  const pw = 64, ph = 58;
  const [cv, c] = makeCanvas(pw, ph);
  c.fillStyle = '#f0ede4';
  c.fillRect(0, 0, pw, ph);
  c.drawImage(srcCanvas, sx, sy, sw, sh, 4, 4, pw - 8, ph - 18);
  c.strokeStyle = '#c8c4b8';
  c.strokeRect(0.5, 0.5, pw - 1, ph - 1);
  return cv;
}
