// scenes.js — everything around the paint scene: title, tag entry,
// the partner tumbler, the sketch, the Bronx map, the black book,
// the between-nights breather, game over.

import { W, H, text, textWidth, centerText, stext, scenter, rect, frame, panel, dither, makeCanvas } from './gfx.js';
import { PARTNERS, SPOTS } from './data.js';
import { makeRng, irange } from './rng.js';
import { makePiece, renderPiece, renderSketch, makeKid, makeCop, makeDog } from './gen.js';
import { newRun, availableSpots, level, loadHighScores, saveHighScore } from './world.js';
import { paintScene, resultScene, drawCrewCorner } from './paint.js';
import { drawSpriteFlip, idleFrame } from './scenery.js';
import { buildBronxMap, MAP_H } from './bronx.js';
import { playBeat, stopBeat, stopAmbience, sfxPop, sfxTick, sfxChime, sfxDoorSlide } from './audio.js';
import { submitScore, fetchScores } from './net.js';
import { IS_TOUCH } from './input.js';

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// twinkling star helper for the menu scenes
function drawTwinkles(ctx, t, seed, count, y0, y1) {
  const rng = makeRng(seed);
  ctx.fillStyle = '#f0e8b0';
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rng() * W), y = y0 + Math.floor(rng() * (y1 - y0));
    const ph = rng() * 6.28, sp = 1.5 + rng() * 2.5, big = rng() < 0.2;
    const tw = Math.sin(t * sp + ph);
    if (tw < -0.2) continue;
    ctx.globalAlpha = 0.3 + tw * 0.55;
    ctx.fillRect(x, y, 1, 1);
    if (big && tw > 0.75) {
      ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1);
      ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x, y + 1, 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}

// the arcade header: 1UP / HIGH SCORE, on every menu screen
let hiTop = 0;
function refreshHi() { hiTop = (loadHighScores()[0] || {}).piecesUp || 0; }

function colText(ctx, str, cx, y, color) {
  stext(ctx, str, cx - textWidth(str) / 2, y, color);
}

function drawHeader(G, ctx, t, showNight = true) {
  const cur = G.run ? G.run.pieces.length : 0;
  if (!G.run || Math.sin(t * 5) > -0.4) colText(ctx, '1UP', 56, 4, '#ff4040');
  colText(ctx, String(cur), 56, 15, '#fff');
  colText(ctx, 'HIGH SCORE', W / 2, 4, '#ff4040');
  colText(ctx, String(Math.max(hiTop, cur)), W / 2, 15, '#fff');
  if (G.run && showNight) {
    colText(ctx, 'NIGHT', W - 56, 4, '#ff4040');
    colText(ctx, String(cur + 1), W - 56, 15, '#fff');
  }
}

// ---- TITLE ----------------------------------------------------------------

const titleScene = {
  enter(G) {
    playBeat(777, 'electro');
    refreshHi();
    G.run = null; // back on the marquee, no live run
    const rng = makeRng(99);
    // the logo is a real piece
    this.logoPiece = makePiece('BURNER', 909, null, 'BURNER');
    this.logo = renderPiece(this.logoPiece);
    this.dripCols = [1, 2, 3].map(r => this.logoPiece.palette[r].hex);
    this.drips = [];
    for (let i = 0; i < 8; i++) this.drips.push(this.newDrip(rng));
    // a skyline for the logo to burn over
    this.bldgs = [];
    let bx = 0;
    while (bx < W) {
      const bw = 18 + Math.floor(rng() * 26);
      this.bldgs.push({ x: bx, w: bw, h: 6 + Math.floor(rng() * 12), seed: Math.floor(rng() * 1e9) });
      bx += bw + 2;
    }
    this.trainX = -180;
    this.t = 0;
    this.idle = 0;
    this.hs = loadHighScores();
    this.kings = null; // tonight's board, from the city itself
    fetchScores().then(list => {
      if (list && list.length) {
        this.kings = list;
        hiTop = Math.max(hiTop, list[0].up);
      }
    });
  },
  newDrip(rng) {
    return {
      x: 112 + Math.floor(rng() * 156), y0: 66 + Math.floor(rng() * 18),
      len: 6 + rng() * 16, y: 0, sp: 2.5 + rng() * 5,
      color: this.dripCols[Math.floor(rng() * this.dripCols.length)],
      hold: 1.5 + rng() * 2, fade: 1,
    };
  },
  update(G, dt) {
    this.t += dt;
    this.idle += dt;
    if (this.idle > 10) { G.go('demo'); return; }
    const rng = makeRng((this.t * 997) & 0xffff);
    for (let i = 0; i < this.drips.length; i++) {
      const d = this.drips[i];
      if (d.y < d.len) d.y += d.sp * dt;         // running
      else if (d.hold > 0) d.hold -= dt;          // beading
      else if (d.fade > 0) d.fade -= dt * 0.8;    // drying
      else this.drips[i] = this.newDrip(rng);     // a fresh drip forms
    }
    this.trainX += dt * 46;
    if (this.trainX > W + 60) this.trainX = -200;
  },
  key(G, e) {
    this.idle = 0;
    if (e.type === 'down' && e.key === 'Enter') G.go('name');
    if (e.type === 'down' && (e.key === 'g' || e.key === 'G')) {
      try { window.open('https://github.com/KuvopLLC/burner/issues', '_blank'); } catch (err) { /* headless */ }
    }
  },
  tap(G, x, y) {
    this.idle = 0;
    if (y > 198) {
      try { window.open('https://github.com/KuvopLLC/burner/issues', '_blank'); } catch (err) { /* headless */ }
      return;
    }
    G.go('name');
  },
  draw(G, ctx) {
    rect(ctx, 0, 0, W, H, '#0c0c1e');
    drawTwinkles(ctx, this.t, 4242, 34, 0, 110);
    // skyline
    for (const b of this.bldgs) {
      rect(ctx, b.x, 170 - b.h, b.w, b.h, '#14141f');
      const wrng = makeRng(b.seed);
      for (let wy = 174 - b.h; wy < 166; wy += 6) {
        for (let wx = b.x + 3; wx < b.x + b.w - 3; wx += 5) {
          if (wrng() < 0.24) rect(ctx, wx, wy, 2, 3, '#c8a04a');
        }
      }
    }
    // the el, and a train running it with lit windows
    rect(ctx, 0, 172, W, 3, '#1e1e2c');
    for (let x = 8; x < W; x += 22) rect(ctx, x, 175, 4, H - 175, '#1e1e2c');
    const tx = Math.round(this.trainX);
    for (let carN = 0; carN < 2; carN++) {
      const cx = tx + carN * 78;
      rect(ctx, cx, 162, 74, 10, '#23232e');
      for (let wx = 4; wx < 70; wx += 8) rect(ctx, cx + wx, 164, 4, 4, '#8a7a48');
      rect(ctx, cx + (carN === 0 ? 72 : -1), 166, 2, 2, '#ffefc0');
    }
    drawHeader(G, ctx, this.t);
    // the burner itself, painted by the same hands as every piece
    ctx.drawImage(this.logo, 96, 24, 192, 72);
    // paint runs: they run, bead up, dry, and new ones form
    for (const d of this.drips) {
      ctx.globalAlpha = Math.max(0, Math.min(1, d.fade));
      ctx.fillStyle = d.color;
      const yLen = Math.round(Math.min(d.y, d.len));
      ctx.fillRect(d.x, d.y0, 2, yLen);
      ctx.fillRect(d.x, d.y0 + yLen, 2, 2); // the bead at the tip
      ctx.globalAlpha = 1;
    }
    scenter(ctx, 'GET UP. STAY UP.', 104, '#39c8e0');
    const board = this.kings
      ? this.kings.map(k => ({ tag: k.tag, piecesUp: k.up }))
      : this.hs;
    if (board.length) {
      if (this.kings) scenter(ctx, "- TONIGHT'S KINGS -", 118, '#ff4040');
      board.slice(0, 5).forEach((h, i) => {
        const line = `${h.tag.padEnd(10, '.')}${String(h.piecesUp).padStart(3, '.')} UP`;
        scenter(ctx, line, 131 + i * 11, i === 0 ? '#ffe040' : '#fff');
      });
    }
    if (Math.sin(this.t * 4) > -0.2) scenter(ctx, IS_TOUCH ? 'TAP TO WRITE' : 'PRESS ENTER', 188, '#ffe040');
    scenter(ctx, IS_TOUCH ? '© 1986 KUVOP · TAP HERE FOR GITHUB' : '© 1986 KUVOP · [G] GITHUB', 205, '#666');
  },
};

// ---- NAME -----------------------------------------------------------------

const GRID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const GRID_COLS = 12, GRID_X = (W - 12 * 26) / 2, GRID_Y = 92, CELL_W = 26, CELL_H = 17;

const nameScene = {
  enter() { this.tag = ''; this.t = 0; this.preview = null; this.stale = true; },
  commit(G) {
    if (this.tag.length < 2) return;
    const seed = (hashStr(this.tag) ^ Date.now()) >>> 0;
    G.run = newRun(this.tag, seed);
    G.go('partner');
  },
  tap(G, x, y) {
    if (!IS_TOUCH) { this.commit(G); return; }
    // the letter grid
    if (y >= GRID_Y && y < GRID_Y + 3 * CELL_H) {
      const col = Math.floor((x - GRID_X) / CELL_W);
      const row = Math.floor((y - GRID_Y) / CELL_H);
      const idx = row * GRID_COLS + col;
      if (col >= 0 && col < GRID_COLS && idx < GRID_CHARS.length && this.tag.length < 8) {
        this.tag += GRID_CHARS[idx];
        this.stale = true;
        sfxTick();
      }
      return;
    }
    // DEL / END row
    if (y >= GRID_Y + 3 * CELL_H + 4 && y < GRID_Y + 3 * CELL_H + 22) {
      if (x < W / 2 - 8) { this.tag = this.tag.slice(0, -1); this.stale = true; }
      else this.commit(G);
    }
  },
  update(G, dt) {
    this.t += dt;
    if (this.stale) {
      this.stale = false;
      this.preview = this.tag.length >= 2
        ? renderPiece(makePiece(this.tag, hashStr(this.tag) + 7, null)) : null;
    }
  },
  key(G, e) {
    if (e.type !== 'down') return;
    const k = e.key.toUpperCase();
    if (/^[A-Z0-9]$/.test(k) && this.tag.length < 8) { this.tag += k; this.stale = true; sfxTick(); }
    if (e.key === 'Backspace') { this.tag = this.tag.slice(0, -1); this.stale = true; }
    if (e.key === 'Enter') this.commit(G);
  },
  draw(G, ctx) {
    rect(ctx, 0, 0, W, H, '#0c0c1e');
    drawTwinkles(ctx, this.t, 777, 22, 0, 40);
    drawHeader(G, ctx, this.t);
    scenter(ctx, 'WRITE YOUR TAG', 30, '#ff4040', 2);
    // eight letter slots, arcade initials style
    const x0 = (W - 8 * 18) / 2;
    for (let i = 0; i < 8; i++) {
      const sx = x0 + i * 18;
      if (i < this.tag.length) {
        stext(ctx, this.tag[i], sx + 1, 56, '#fff', 2);
      }
      const isCursor = i === this.tag.length;
      rect(ctx, sx, 74, 12, 2,
        isCursor && Math.sin(this.t * 6) > 0 ? '#ffe040' : i < this.tag.length ? '#39c8e0' : '#33334a');
    }
    if (IS_TOUCH) {
      // the letter grid: fat targets, arcade initials style
      for (let i = 0; i < GRID_CHARS.length; i++) {
        const gx = GRID_X + (i % GRID_COLS) * CELL_W;
        const gy = GRID_Y + Math.floor(i / GRID_COLS) * CELL_H;
        panel(ctx, gx + 1, gy + 1, CELL_W - 3, CELL_H - 3, '#14142a', '#33334a');
        stext(ctx, GRID_CHARS[i], gx + Math.floor((CELL_W - 8) / 2), gy + 5, '#fff');
      }
      const ry = GRID_Y + 3 * CELL_H + 4;
      panel(ctx, GRID_X, ry, 150, 17, '#14142a', '#5a3a3a');
      stext(ctx, 'DEL', GRID_X + 62, ry + 5, '#ff8080');
      panel(ctx, W / 2 + 6, ry, 150, 17, '#14142a', '#3a5a3a');
      stext(ctx, this.tag.length >= 2 ? 'END' : '...', W / 2 + 6 + 64, ry + 5, this.tag.length >= 2 ? '#40e050' : '#555');
      if (this.preview) ctx.drawImage(this.preview, (W - 120) / 2, 168, 120, 45);
    } else {
      if (this.preview) {
        // how it's going to look on a wall
        ctx.drawImage(this.preview, 72, 90, 240, 90);
      } else {
        scenter(ctx, '. . .', 126, '#33334a', 2);
      }
      if (this.tag.length >= 2 && Math.sin(this.t * 4) > -0.3) scenter(ctx, '[ENTER] THAT\'S ME', 198, '#ffe040');
    }
  },
};

// ---- PARTNER TUMBLER --------------------------------------------------------

const partnerScene = {
  enter(G) {
    const run = G.run;
    playBeat(hashStr('tumbler') + level(run) * 37, 'funk');
    this.cands = PARTNERS.slice();
    this.target = irange(run.rng, 0, this.cands.length - 1);
    this.pos = 0;               // reel position in partner-heights
    this.speed = 10 + run.rng() * 3;
    this.locked = false;
    this.lockT = 0;
    this.sprites = this.cands.map(p => makeKid(hashStr(p.tag), p.hue));
    this.art = null;
    // spin long enough to land exactly on target
    const stopAt = Math.ceil(this.speed * this.speed / (2 * 8)); // decel 8/s^2
    let lap = Math.ceil((this.pos + stopAt) / this.cands.length) * this.cands.length;
    this.stopPos = lap + this.target;
  },
  update(G, dt) {
    this.animT = (this.animT || 0) + dt;
    if (this.locked) { this.lockT += dt; return; }
    // decelerate so we stop on stopPos
    const remaining = this.stopPos - this.pos;
    this.speed = Math.max(1.5, Math.min(this.speed, Math.sqrt(2 * 8 * Math.max(0.001, remaining))));
    this.pos += this.speed * dt;
    if (this.pos >= this.stopPos - 0.02) {
      this.pos = this.stopPos;
      this.locked = true;
      sfxPop();
      const partner = this.cands[this.target];
      G.run.partner = partner;
      this.art = renderPiece(makePiece(partner.tag, hashStr(partner.tag) + 5));
    }
  },
  key(G, e) {
    if (e.type !== 'down' || e.key !== 'Enter') return;
    if (!this.locked) { this.pos = this.stopPos - 0.01; return; } // impatient? snap it
    if (this.lockT > 0.6) G.go('sketch');
  },
  draw(G, ctx) {
    const run = G.run;
    rect(ctx, 0, 0, W, H, '#0c0c1e');
    drawHeader(G, ctx, this.animT || 0);
    scenter(ctx, 'TONIGHT\'S PARTNER', 26, '#ff4040');

    // the reel window, dead center
    const rw = 150, rh = 70, rx = (W - 150) / 2, ry = 38;
    panel(ctx, rx, ry, rw, rh, '#08080e', this.locked ? '#ffe040' : '#3a3a52');
    ctx.save();
    ctx.beginPath();
    ctx.rect(rx + 1, ry + 1, rw - 2, rh - 2);
    ctx.clip();
    const n = this.cands.length;
    for (let k = -1; k <= 1; k++) {
      const idx = ((Math.round(this.pos) + k) % n + n) % n;
      const p = this.cands[idx];
      const yOff = (Math.round(this.pos) + k - this.pos) * 36 + ry + rh / 2 - 15;
      drawSpriteFlip(ctx, idleFrame(this.sprites[idx], this.animT || 0, idx * 0.7), rx + 8, yOff, false);
      text(ctx, p.tag, rx + 34, yOff + 12, k === 0 || this.locked ? '#fff' : '#666');
    }
    ctx.restore();
    // pointers, both sides
    text(ctx, '>', rx - 12, ry + rh / 2 - 6, '#ffe040');
    text(ctx, '<', rx + rw + 7, ry + rh / 2 - 6, '#ffe040');

    if (this.locked) {
      const p = run.partner;
      if (this.lockT < 0.3) frame(ctx, rx - 2, ry - 2, rw + 4, rh + 4, '#fff'); // POP flash
      panel(ctx, 36, 128, 160, 76, '#101018', '#3a3a52');
      text(ctx, p.style, 42, 133, '#ff3060');
      const bioEnd = wrapText(ctx, p.bio, 42, 146, 148, '#ccc');
      wrapText(ctx, 'PERK: ' + p.perk, 42, bioEnd + 3, 148, '#40e050');
      // their art
      if (this.art) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.art, 212, 140, 136, 51);
        frame(ctx, 211, 139, 138, 53, '#3a3a52');
      }
      if (this.lockT > 0.6 && Math.sin(this.lockT * 4) > -0.3) scenter(ctx, '[ENTER] SKETCH', 206, '#ffe040');
    } else {
    }
  },
};

function wrapText(ctx, str, x, y, maxW, color) {
  const words = str.split(' ');
  let line = '', yy = y;
  for (const w2 of words) {
    const test = line ? line + ' ' + w2 : w2;
    if (textWidth(test) > maxW) {
      text(ctx, line, x, yy, color);
      line = w2; yy += 10;
    } else line = test;
  }
  if (line) text(ctx, line, x, yy, color);
  return yy + 10;
}

// ---- SKETCH ----------------------------------------------------------------

const sketchScene = {
  enter(G) {
    const run = G.run;
    const seed = (hashStr(run.tag + run.partner.tag) + (level(run) + 1) * 7919) >>> 0;
    run.piece = makePiece(run.tag, seed, run.partner.tag);
    this.sketch = renderSketch(run.piece);
    this.t = 0;
  },
  update(G, dt) { this.t += dt; },
  key(G, e) {
    if (e.type === 'down' && e.key === 'Enter' && this.t > 1) G.go('map');
  },
  draw(G, ctx) {
    const run = G.run;
    rect(ctx, 0, 0, W, H, '#14100c');
    // the black book, open
    panel(ctx, 56, 20, 272, 162, '#efe9d8', '#8a7a5a');
    rect(ctx, 190, 22, 2, 158, '#c8bfa4'); // spine
    text(ctx, `PIECE NO. ${level(run) + 1}`, 66, 30, '#6a5a3a');
    text(ctx, `"${run.piece.word}" W/ ${run.partner.tag}`, 66, 46, '#a05030');
    // sketch reveals left to right
    const reveal = Math.min(1, this.t / 1.6) * run.piece.w;
    ctx.save();
    ctx.beginPath(); ctx.rect(66, 74, reveal * 0.48, 46); ctx.clip();
    ctx.drawImage(this.sketch, 66, 74, run.piece.w * 0.48, run.piece.h * 0.48);
    ctx.restore();
    // colors needed
    text(ctx, 'THE CANS:', 202, 30, '#6a5a3a');
    const regionNames = { 1: 'FILL A', 2: 'FILL B', 3: 'LINES', 4: 'SHADOW', 5: 'CLOUD' };
    [1, 2, 3, 4, 5].forEach((r, i) => {
      const c = run.piece.palette[r];
      rect(ctx, 204, 46 + i * 15, 9, 10, c.hex);
      text(ctx, c.name, 218, 48 + i * 15, '#4a4034');
    });
    drawCrewCorner(G, ctx);
    if (this.t > 1 && Math.sin(this.t * 4) > -0.3) scenter(ctx, '[ENTER] THE MAP', 196, '#ffe040');
  },
};

// ---- MAP -------------------------------------------------------------------

let bronxMap = null; // built once, kept for the whole session
const MAP_X = (W - 320) / 2;

const mapScene = {
  enter(G) {
    playBeat(hashStr('map') + level(G.run) * 71, 'latin');
    if (!bronxMap) bronxMap = buildBronxMap();
    this.spots = availableSpots(G.run).slice().sort((a, b) => a.x - b.x);
    this.sel = 0;
    this.t = 0;
    this.retX = this.spots[0].x; this.retY = this.spots[0].y;
  },
  update(G, dt) {
    this.t += dt;
    const s = this.spots[this.sel];
    this.retX += (s.x - this.retX) * Math.min(1, dt * 10);
    this.retY += (s.y - this.retY) * Math.min(1, dt * 10);
  },
  key(G, e) {
    if (e.type !== 'down') return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { this.sel = (this.sel + 1) % this.spots.length; sfxTick(); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { this.sel = (this.sel + this.spots.length - 1) % this.spots.length; sfxTick(); }
    if (e.key === 'Enter') {
      G.run.spot = this.spots[this.sel];
      G.go('doors');
    }
  },
  tap(G, x, y) {
    // info bar (or the selected spot again) = GO
    if (y >= MAP_H) { G.run.spot = this.spots[this.sel]; G.go('doors'); return; }
    let best = -1, bd = 1e9;
    this.spots.forEach((s2, i) => {
      const d = (MAP_X + s2.x - x) ** 2 + (s2.y - y) ** 2;
      if (d < bd) { bd = d; best = i; }
    });
    if (best >= 0 && bd < 30 * 30) {
      if (best === this.sel) { G.run.spot = this.spots[this.sel]; G.go('doors'); }
      else { this.sel = best; sfxTick(); }
    }
  },
  draw(G, ctx) {
    // the asset is 320 wide; center it and let the water continue
    rect(ctx, 0, 0, W, MAP_H, '#0e1c30');
    ctx.drawImage(bronxMap, MAP_X, 0);

    // spots
    this.spots.forEach((s, i) => {
      const col = s.kind === 'train' ? '#ff4070' : s.kind === 'gallery' ? '#c8c8d8' : '#ffd94a';
      const blink = Math.sin(this.t * 5 + i) > 0;
      rect(ctx, MAP_X + s.x - 1, s.y - 1, 3, 3, blink || i === this.sel ? col : '#6a6a55');
      if (i === this.sel) frame(ctx, MAP_X + s.x - 3, s.y - 3, 7, 7, col);
    });

    // reticle
    const rx = MAP_X + Math.round(this.retX), ry = Math.round(this.retY);
    frame(ctx, rx - 6, ry - 6, 13, 13, '#fff');
    rect(ctx, rx - 10, ry, 3, 1, '#fff'); rect(ctx, rx + 8, ry, 3, 1, '#fff');
    rect(ctx, rx, ry - 10, 1, 3, '#fff'); rect(ctx, rx, ry + 8, 1, 3, '#fff');

    // info bar lives BELOW the map — the borough stays clear
    const s = this.spots[this.sel];
    rect(ctx, 0, MAP_H, W, H - MAP_H, '#0d0d15');
    rect(ctx, 0, MAP_H, W, 1, '#32324a');
    text(ctx, s.name + (s.line ? ` (${s.line})` : ''), 8, 190, '#fff');
    text(ctx, 'DANGER ' + (s.danger ? '★'.repeat(s.danger) : 'NONE'), 232, 190, '#ff5030');
    if (Math.sin(this.t * 4) > -0.3) text(ctx, IS_TOUCH ? 'TAP GO' : '[ENTER] GO', 316, 190, '#ffe040');
    drawCrewCorner(G, ctx);
  },
};

// ---- BOOK -------------------------------------------------------------------

const bookScene = {
  enter(G) { this.page = Math.max(0, Math.ceil(G.run.pieces.length / 2) - 1); },
  swipe(G, dir, axis = 'y') {
    if (axis !== 'x') return;
    const maxPage = Math.max(0, Math.ceil(G.run.pieces.length / 2) - 1);
    // swipe left = next page, like flipping paper
    this.page = Math.max(0, Math.min(maxPage, this.page + (dir < 0 ? 1 : -1)));
  },
  key(G, e) {
    if (e.type !== 'down') return;
    const maxPage = Math.max(0, Math.ceil(G.run.pieces.length / 2) - 1);
    if (e.key === 'ArrowRight' && this.page < maxPage) this.page++;
    if (e.key === 'ArrowLeft' && this.page > 0) this.page--;
    if (e.key === 'Enter' || e.key === 'Escape') G.go(G.bookReturn || 'intermission');
  },
  draw(G, ctx) {
    const run = G.run;
    rect(ctx, 0, 0, W, H, '#14100c');
    panel(ctx, 44, 10, 296, 168, '#efe9d8', '#8a7a5a');
    rect(ctx, 191, 12, 2, 164, '#c8bfa4');
    const entries = run.pieces.slice(this.page * 2, this.page * 2 + 2);
    entries.forEach((e, i) => {
      const x = 52 + i * 148;
      const spot = SPOTS.find(sp => sp.id === e.spotId);
      text(ctx, `NO.${e.id} ${spot.name}`, x, 16, '#4a4034');
      text(ctx, `W/ ${e.partnerTag}`, x, 29, '#a05030');
      ctx.drawImage(e.sketch, x, 40, 100, 37);
      ctx.drawImage(e.polaroid, x + 36, 82);
      // the check mark
      text(ctx, '✓', x + 108, 40, '#308030', 2);
      text(ctx, e.status === 'UP' ? 'STILL UP' : 'BUFFED', x + 36, 144,
        e.status === 'UP' ? '#308030' : '#8a7a5a');
    });
    if (!run.pieces.length) centerText(ctx, 'NOTHING IN THE BOOK YET', 88, '#8a7a5a');
    text(ctx, `PAGE ${this.page + 1}`, 182, 166, '#8a7a5a');
    const n = run.pieces.length;
    scenter(ctx, `${n} UP · ${'♥'.repeat(Math.max(0, run.hearts))}`, 186, '#ffe040');
    scenter(ctx, IS_TOUCH ? 'SWIPE FLIPS · TAP CLOSES' : '< > FLIP · [ENTER] CLOSE', 202, '#9a9aa8');
  },
};

// ---- BETWEEN NIGHTS ---------------------------------------------------------

const intermissionScene = {
  enter(G) {
    playBeat(hashStr('night') + level(G.run) * 53, 'boombap');
    this.t = 0;
    this.kid = makeKid(hashStr(G.run.tag), hashStr(G.run.tag) % 360);
    this.pal = G.run.partner ? makeKid(hashStr(G.run.partner.tag), G.run.partner.hue) : null;
  },
  update(G, dt) { this.t += dt; },
  key(G, e) {
    if (e.type !== 'down') return;
    if (e.key === 'Enter') { G.run.partner = null; G.go('partner'); }
    if (e.key === 'b' || e.key === 'B') { G.bookReturn = 'intermission'; G.go('book'); }
  },
  tap(G, x, y) {
    if (y >= 134) { G.bookReturn = 'intermission'; G.go('book'); }
    else { G.run.partner = null; G.go('partner'); }
  },
  draw(G, ctx) {
    const run = G.run;
    rect(ctx, 0, 0, W, H, '#0c0c1e');
    drawTwinkles(ctx, this.t, 1717, 30, 0, 90);
    // moon
    for (let dy = -4; dy <= 4; dy++) {
      const ww = Math.round(Math.sqrt(16 - dy * dy));
      rect(ctx, 270 - ww, 26 + dy, ww * 2, 1, '#e8e4c8');
    }
    rect(ctx, 267, 24, 2, 2, '#d0ccb0'); rect(ctx, 272, 28, 2, 2, '#d0ccb0');
    // rooftops, dusk-washed
    dither(ctx, 0, 96, W, 20, '#2a1a30');
    for (let x = 0; x < W; x += 40) {
      const bh = x % 80 ? 8 : 0;
      rect(ctx, x, 108 + bh, 34, H - 108 - bh, '#16121e');
      for (let wy = 0; wy < 3; wy++) for (let wx = 0; wx < 3; wx++)
        if ((x + wy + wx) % 3) rect(ctx, x + 6 + wx * 9, 116 + bh + wy * 12, 4, 5, '#3a3020');
    }
    // water tower + antenna on the near roofs
    rect(ctx, 248, 94, 16, 12, '#241c18'); rect(ctx, 250, 91, 12, 3, '#2c221c');
    rect(ctx, 249, 106, 2, 4, '#241c18'); rect(ctx, 261, 106, 2, 4, '#241c18');
    rect(ctx, 164, 96, 1, 12, '#2a2a34'); rect(ctx, 160, 98, 9, 1, '#2a2a34');
    // your crew on the front roof, watching the city
    rect(ctx, 0, 188, W, 28, '#100c14');
    rect(ctx, 0, 188, W, 2, '#231a26');
    drawSpriteFlip(ctx, idleFrame(this.kid, this.t, 0), 42, 159, false);
    if (this.pal) drawSpriteFlip(ctx, idleFrame(this.pal, this.t, 1.2), 66, 159 + (Math.sin(this.t * 1.4) > 0.7 ? 1 : 0), false);
    // a pigeon keeping its distance
    const px = 100 + Math.floor(Math.sin(this.t * 0.7) * 3);
    rect(ctx, px, 184, 4, 3, '#8a8a96'); rect(ctx, px + 3, 182, 2, 2, '#8a8a96');
    if (Math.sin(this.t * 3.1) > 0.8) rect(ctx, px + 4, 181, 1, 1, '#8a8a96'); // peck

    drawHeader(G, ctx, this.t, false);
    const n = level(run);
    scenter(ctx, `NIGHT ${n + 1}`, 32, '#ffe040', 2);
    // your hearts
    for (let i = 0; i < 3; i++) {
      stext(ctx, '♥', W / 2 - 16 + i * 12, 58, i < run.hearts ? '#ff4050' : '#33334a');
    }
    if (Math.sin(this.t * 4) > -0.3) scenter(ctx, IS_TOUCH ? 'TAP TO PAINT' : '[ENTER] PAINT', 122, '#ffe040');
    scenter(ctx, IS_TOUCH ? 'TAP HERE: THE BOOK' : '[B] THE BOOK', 140, '#c0a060');
  },
};

// ---- GAME OVER -----------------------------------------------------------------

const gameoverScene = {
  enter(G) {
    stopBeat();
    stopAmbience();
    this.t = 0;
    const run = G.run;
    const n = level(run);
    this.hs = saveHighScore(run.tag, n);
    this.isKing = this.hs.length && this.hs[0].tag === run.tag && this.hs[0].piecesUp === n;
    if (n > 0) submitScore(run.tag, n);
  },
  update(G, dt) { this.t += dt; },
  key(G, e) {
    if (e.type === 'down' && e.key === 'Enter') G.go('title');
  },
  draw(G, ctx) {
    const run = G.run;
    const n = level(run);
    rect(ctx, 0, 0, W, H, '#120608');
    // the cruiser's lights, washing the block
    const ph = Math.sin(this.t * 3.2);
    ctx.globalAlpha = 0.09 + Math.max(0, ph) * 0.08;
    rect(ctx, 0, 0, W / 2, H, '#ff2030');
    ctx.globalAlpha = 0.09 + Math.max(0, -ph) * 0.08;
    rect(ctx, W / 2, 0, W / 2, H, '#2040ff');
    ctx.globalAlpha = 1;
    drawHeader(G, ctx, this.t);
    scenter(ctx, 'GAME OVER', 36, '#ff4040', 3);
    scenter(ctx, '- RESULTS -', 84, '#ff4040');
    const rows = [
      ['NIGHTS SURVIVED', n],
      ['BURNERS UP', n],
      ['BURSTS SPRAYED', run.bursts],
      ['JUMPS', run.jumps],
    ];
    rows.forEach(([label, v], i) => {
      const line = label.padEnd(17, '.') + String(v).padStart(5, '.');
      scenter(ctx, line, 100 + i * 13, '#fff');
    });
    if (this.isKing && n > 0) scenter(ctx, '*** KING OF THE LINE ***', 162, '#40e050');
    if (Math.sin(this.t * 4) > -0.3) scenter(ctx, IS_TOUCH ? 'TAP' : 'PRESS ENTER', 192, '#ffe040');
  },
};

// ---- THE DOORS -------------------------------------------------------------
// You ride to the spot. The doors wear tonight's number, sprayed across
// both leaves — the chime sounds, the leaves part, the piece splits,
// and the night is behind them.

const LEAF_W = (W - 20) / 2; // 182

function buildDoorLeaf(side, pieceCv) {
  const [cv, c] = makeCanvas(LEAF_W, H);
  // brushed steel
  rect(c, 0, 0, LEAF_W, H, '#8d939b');
  c.fillStyle = '#868c94';
  for (let x = 3; x < LEAF_W; x += 5) c.fillRect(x, 0, 1, H);
  // door window, rounded corners
  const wx = side === 0 ? 34 : 18, wy = 30, ww = 130, wh = 68;
  rect(c, wx - 2, wy - 2, ww + 4, wh + 4, '#6a7078');
  rect(c, wx, wy, ww, wh, '#14161c');
  for (const [cx, cy] of [[wx, wy], [wx + ww - 1, wy], [wx, wy + wh - 1], [wx + ww - 1, wy + wh - 1]]) {
    rect(c, cx, cy, 1, 1, '#6a7078');
  }
  rect(c, wx + 4, wy + 3, ww - 34, 2, '#2a3038'); // glass sheen
  // kick plate + bolts
  rect(c, 0, 162, LEAF_W, 36, '#798088');
  rect(c, 0, 162, LEAF_W, 1, '#5c6168');
  for (const bx of [16, 62, 116, 164]) rect(c, bx, 178, 2, 2, '#5c6168');
  // the piece half first: piece sits at screen x72 w240, split at W/2
  if (side === 0) c.drawImage(pieceCv, 0, 0, 120, 90, 72 - 10, 56, 120, 90);
  else c.drawImage(pieceCv, 120, 0, 120, 90, 0, 56, 120, 90);
  // ...then the rubber gasket OVER it, so the paint stops at the seam
  const edgeX = side === 0 ? LEAF_W - 5 : 0;
  rect(c, edgeX, 0, 5, H, '#15151a');
  rect(c, side === 0 ? LEAF_W - 7 : 5, 0, 2, H, '#3c4048');
  return cv;
}

const doorsScene = {
  enter(G) {
    // the night is already alive behind the doors
    paintScene.enter(G);
    const n = level(G.run) + 1;
    const piece = makePiece(G.run.tag, hashStr('doors' + n + G.run.tag) >>> 0, null, `NIGHT ${n}`);
    const pieceCv = renderPiece(piece);
    this.leafL = buildDoorLeaf(0, pieceCv);
    this.leafR = buildDoorLeaf(1, pieceCv);
    this.t = 0;
    this.chimed = false;
    this.slid = false;
    sfxDoorSlide(); // arrival hiss
  },
  update(G, dt) {
    this.t += dt;
    paintScene.s.scenery.update(dt); // the street lives while you arrive
    if (!this.chimed && this.t > 0.7) { this.chimed = true; sfxChime(); }
    if (!this.slid && this.t > 1.15) { this.slid = true; sfxDoorSlide(); }
    if (this.t > 2.7) {
      // hand over to the live paint scene without re-entering
      G.sceneName = 'paint';
      G.scene = paintScene;
    }
  },
  key(G, e) {
    if (e.type === 'down' && (e.key === 'Enter' || e.key === ' ' || e.key === 'x')) {
      this.t = Math.max(this.t, 1.15); // skip the wait, roll the doors
    }
  },
  draw(G, ctx) {
    // the night behind the doors
    paintScene.draw(G, ctx);
    // door travel: eased slide after the chime
    const slide = Math.max(0, Math.min(1, (this.t - 1.15) / 1.25));
    const ease = slide < 0.5 ? 2 * slide * slide : 1 - Math.pow(-2 * slide + 2, 2) / 2;
    const off = Math.round(ease * (LEAF_W + 4));
    ctx.drawImage(this.leafL, 10 - off, 0);
    ctx.drawImage(this.leafR, W / 2 + off, 0);
    // frame pillars + header band over everything
    rect(ctx, 0, 0, 10, H, '#5c6168');
    rect(ctx, W - 10, 0, 10, H, '#5c6168');
    rect(ctx, 8, 0, 1, H, '#3c4048');
    rect(ctx, W - 9, 0, 1, H, '#3c4048');
    rect(ctx, 0, 0, W, 22, '#4c5057');
    rect(ctx, 0, 21, W, 1, '#2e3238');
    // destination sign
    rect(ctx, (W - 108) / 2, 5, 108, 13, '#0c0c10');
    frame(ctx, (W - 108) / 2, 5, 108, 13, '#2e3238');
    text(ctx, 'BRONX BOUND', (W - 66) / 2, 8, '#f0a028');
    // threshold
    rect(ctx, 0, H - 32, W, 4, '#3c4048');
    rect(ctx, 0, H - 28, W, 28, '#17171d');
    ctx.fillStyle = '#f0c040';
    for (let x = 4; x < W; x += 12) ctx.fillRect(x, H - 31, 6, 2); // caution stripe
  },
};

// ---- DEMO (attract mode) -----------------------------------------------------
// Leave the title alone for ten seconds and the game shows itself off:
// an AI writer paints a real wall, hides from real trouble, with the
// controls on screen. Any key hands the can back.

const demoScene = {
  enter(G) {
    const seed = (Math.floor(Math.random() * 1e9)) >>> 0;
    G.run = newRun('CHINO', seed);
    G.run.partner = PARTNERS[seed % PARTNERS.length];
    G.run.piece = makePiece('CHINO', seed ^ 4242, G.run.partner.tag);
    G.run.spot = SPOTS.find(sp => sp.kind === 'train');
    paintScene.enter(G);
    this.t = 0;
    this.cursor = 0;
    this.burstT = 0.4;
  },
  exit(G) {
    G.go('title'); // title enter clears the demo run
  },
  key(G, e) {
    if (e.type === 'down') this.exit(G);
  },
  update(G, dt) {
    this.t += dt;
    const s = paintScene.s;
    // leave before any transition fires: no results, no strikes, no book
    if (!s || s.dead || s.done || this.t > 30 || G.run.hearts <= 0) { this.exit(G); return; }
    paintScene.update(G, dt);

    // the AI writer: jump anything that gets close
    const kidC = s.kidX + 10;
    for (const e of s.enemies) {
      const eC = e.x + 10;
      if (Math.abs(eC - kidC) < 34 && !s.airborne) {
        paintScene.swipe(G, -1);
        break;
      }
    }

    const regs = [1, 2, 3, 4, 5].filter(r => !s.regDone[r]);
    if (!regs.length) return;
    const reg = regs[0];
    const total = s.piece.w * s.piece.h;
    let found = -1, i = this.cursor;
    for (let scanned = 0; scanned < total; scanned++, i = (i + 11) % total) {
      if (s.piece.regions[i] === reg && !s.covered[i]) { found = i; break; }
    }
    if (found < 0) return;
    this.cursor = (found + 11) % total;
    // the demo plays the way a thumb would: tap the work
    this.burstT -= dt;
    if (!s.order && !s.flood && this.burstT <= 0) {
      this.burstT = 0.35;
      paintScene.tap(G, 72 + (found % s.piece.w), 34 + Math.floor(found / s.piece.w));
    }
  },
  draw(G, ctx) {
    paintScene.draw(G, ctx);
    if (Math.sin(this.t * 3) > -0.2) scenter(ctx, 'D E M O', 66, '#fff', 2);
    if (Math.sin(this.t * 4) > -0.3) scenter(ctx, IS_TOUCH ? 'TAP TO TAKE OVER' : 'PRESS ENTER', 166, '#ffe040');
  },
};

export const SCENES = {
  doors: doorsScene,
  demo: demoScene,
  title: titleScene,
  name: nameScene,
  partner: partnerScene,
  sketch: sketchScene,
  map: mapScene,
  paint: paintScene,
  result: resultScene,
  book: bookScene,
  intermission: intermissionScene,
  gameover: gameoverScene,
};
