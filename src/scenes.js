// scenes.js — everything around the paint scene: title, tag entry,
// the partner tumbler, the sketch, the Bronx map, the black book,
// the between-nights breather, game over.

import { W, H, text, textWidth, centerText, rect, frame, panel, dither } from './gfx.js';
import { PARTNERS, SPOTS } from './data.js';
import { makeRng, irange } from './rng.js';
import { makePiece, renderPiece, renderSketch, makeKid } from './gen.js';
import { newRun, availableSpots, level, loadHighScores, saveHighScore } from './world.js';
import { paintScene, resultScene, drawCrewCorner } from './paint.js';
import { drawSpriteFlip, idleFrame } from './scenery.js';
import { buildBronxMap, MAP_H } from './bronx.js';
import { playBeat, stopBeat, stopAmbience, sfxPop, sfxTick } from './audio.js';

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

// ---- TITLE ----------------------------------------------------------------

const titleScene = {
  enter(G) {
    playBeat(777);
    const rng = makeRng(99);
    this.drips = [];
    for (let i = 0; i < 14; i++) {
      this.drips.push({ x: 92 + rng() * 136, y: 70, len: 4 + rng() * 14, sp: 3 + rng() * 6 });
    }
    // a skyline for the logo to burn over
    this.bldgs = [];
    let bx = 0;
    while (bx < W) {
      const bw = 18 + Math.floor(rng() * 26);
      this.bldgs.push({ x: bx, w: bw, h: 10 + Math.floor(rng() * 16), seed: Math.floor(rng() * 1e9) });
      bx += bw + 2;
    }
    this.trainX = -180;
    this.t = 0;
    this.hs = loadHighScores();
  },
  update(G, dt) {
    this.t += dt;
    for (const d of this.drips) if (d.y - 70 < d.len) d.y += d.sp * dt;
    this.trainX += dt * 46;
    if (this.trainX > W + 60) this.trainX = -200;
  },
  key(G, e) {
    if (e.type === 'down' && e.key === 'Enter') G.go('name');
  },
  draw(G, ctx) {
    rect(ctx, 0, 0, W, H, '#0c0c1e');
    drawTwinkles(ctx, this.t, 4242, 34, 0, 110);
    // skyline
    for (const b of this.bldgs) {
      rect(ctx, b.x, 158 - b.h, b.w, b.h, '#14141f');
      const wrng = makeRng(b.seed);
      for (let wy = 162 - b.h; wy < 154; wy += 6) {
        for (let wx = b.x + 3; wx < b.x + b.w - 3; wx += 5) {
          if (wrng() < 0.24) rect(ctx, wx, wy, 2, 3, '#c8a04a');
        }
      }
    }
    // the el, and a train running it with lit windows
    rect(ctx, 0, 160, W, 3, '#1e1e2c');
    for (let x = 8; x < W; x += 22) rect(ctx, x, 163, 4, 37, '#1e1e2c');
    const tx = Math.round(this.trainX);
    for (let carN = 0; carN < 2; carN++) {
      const cx = tx + carN * 78;
      rect(ctx, cx, 150, 74, 10, '#23232e');
      for (let wx = 4; wx < 70; wx += 8) rect(ctx, cx + wx, 152, 4, 4, '#8a7a48');
      rect(ctx, cx + (carN === 0 ? 72 : -1), 154, 2, 2, '#ffefc0');
    }
    centerText(ctx, 'KUVOP PRESENTS', 26, '#666');
    centerText(ctx, 'BURNER', 42, '#ff3060', 4);
    // glint sweeping the logo
    const sweep = (this.t % 4) / 4 * (W - 120) + 60;
    ctx.save();
    ctx.beginPath();
    ctx.rect(sweep, 40, 9, 32);
    ctx.clip();
    centerText(ctx, 'BURNER', 42, '#ffd7e2', 4);
    ctx.restore();
    ctx.fillStyle = '#ff3060';
    for (const d of this.drips) ctx.fillRect(Math.round(d.x), 70, 2, Math.round(d.y - 70) + 2);
    centerText(ctx, 'GET UP. STAY UP.', 100, '#ffe040');
    if (this.hs.length) {
      centerText(ctx, '-- KINGS OF THE LINE --', 114, '#888');
      this.hs.slice(0, 3).forEach((h, i) => {
        centerText(ctx, `${h.tag}  ${h.piecesUp} UP`, 124 + i * 10, i === 0 ? '#ffe040' : '#aaa');
      });
    } else {
      centerText(ctx, '[X] SPRAY   ARROWS: CANS   [SPACE] HIDE', 124, '#888');
    }
    if (Math.sin(this.t * 4) > -0.2) centerText(ctx, '[ENTER] START WRITING', 178, '#fff');
  },
};

// ---- NAME -----------------------------------------------------------------

const nameScene = {
  enter() { this.tag = ''; this.t = 0; this.preview = null; this.stale = true; },
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
    if (e.key === 'Enter' && this.tag.length >= 2) {
      const seed = (hashStr(this.tag) ^ Date.now()) >>> 0;
      G.run = newRun(this.tag, seed);
      G.go('partner');
    }
  },
  draw(G, ctx) {
    rect(ctx, 0, 0, W, H, '#0c0c1e');
    drawTwinkles(ctx, this.t, 777, 22, 0, 40);
    centerText(ctx, 'EVERY WRITER NEEDS A NAME', 26, '#888');
    centerText(ctx, 'WRITE YOUR TAG', 40, '#fff', 2);
    const shown = this.tag + (Math.sin(this.t * 6) > 0 ? '_' : ' ');
    centerText(ctx, shown, 66, '#ffe040', 2);
    if (this.preview) {
      // how it might look on a wall someday
      ctx.drawImage(this.preview, 40, 88, 240, 90);
    } else {
      centerText(ctx, '. . .', 126, '#33334a', 2);
    }
    centerText(ctx, '2-8 LETTERS. SHORT NAMES GO UP FASTER.', 182, '#888');
    if (this.tag.length >= 2) centerText(ctx, '[ENTER] THAT\'S ME', 192, '#fff');
  },
};

// ---- PARTNER TUMBLER --------------------------------------------------------

const partnerScene = {
  enter(G) {
    const run = G.run;
    playBeat(hashStr('tumbler') + level(run));
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
    centerText(ctx, 'TONIGHT YOU\'RE PAINTING WITH...', 10, '#888');

    // the reel window
    const rw = 130, rh = 64, rx = 20, ry = 26;
    panel(ctx, rx, ry, rw, rh, '#08080e', this.locked ? '#ffe040' : '#3a3a52');
    ctx.save();
    ctx.beginPath();
    ctx.rect(rx + 1, ry + 1, rw - 2, rh - 2);
    ctx.clip();
    const n = this.cands.length;
    for (let k = -1; k <= 1; k++) {
      const idx = ((Math.round(this.pos) + k) % n + n) % n;
      const p = this.cands[idx];
      const yOff = (Math.round(this.pos) + k - this.pos) * 26 + ry + rh / 2 - 12;
      drawSpriteFlip(ctx, idleFrame(this.sprites[idx], this.animT || 0, idx * 0.7), rx + 8, yOff, false);
      text(ctx, p.tag, rx + 30, yOff + 9, k === 0 || this.locked ? '#fff' : '#666');
    }
    ctx.restore();
    // pointer
    text(ctx, '>', rx - 10, ry + rh / 2 - 6, '#ffe040');

    if (this.locked) {
      const p = run.partner;
      if (this.lockT < 0.3) frame(ctx, rx - 2, ry - 2, rw + 4, rh + 4, '#fff'); // POP flash
      centerText(ctx, `*POP* ${run.tag} + ${p.tag}`, 98, '#ffe040', 1);
      panel(ctx, 20, 110, 152, 78, '#101018', '#3a3a52');
      text(ctx, p.style, 26, 114, '#ff3060');
      const bioEnd = wrapText(ctx, p.bio, 26, 126, 140, '#ccc');
      wrapText(ctx, 'PERK: ' + p.perk, 26, bioEnd + 2, 140, '#40e050');
      // their art
      text(ctx, 'THEIR LAST PIECE:', 180, 108, '#888');
      if (this.art) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.art, 180, 118, 120, 45);
        frame(ctx, 180, 118, 120, 45, '#3a3a52');
      }
      if (this.lockT > 0.6) centerText(ctx, '[ENTER] SKETCH THE PIECE', 188, '#fff');
    } else {
      centerText(ctx, 'THE TUMBLER SPINS...', 110, '#666');
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
    panel(ctx, 24, 20, 272, 150, '#efe9d8', '#8a7a5a');
    rect(ctx, 158, 22, 2, 146, '#c8bfa4'); // spine
    text(ctx, 'THE BLACK BOOK', 34, 26, '#6a5a3a');
    text(ctx, `PIECE NO. ${level(run) + 1}`, 34, 38, '#6a5a3a');
    text(ctx, `W/ ${run.partner.tag}`, 34, 50, '#a05030');
    text(ctx, `"${run.piece.word}"`, 100, 50, '#6a5a3a');
    // sketch reveals left to right
    const reveal = Math.min(1, this.t / 1.6) * run.piece.w;
    ctx.save();
    ctx.beginPath(); ctx.rect(34, 66, reveal * 0.48, 46); ctx.clip();
    ctx.drawImage(this.sketch, 34, 66, run.piece.w * 0.48, run.piece.h * 0.48);
    ctx.restore();
    // colors needed
    text(ctx, 'CANS WE NEED:', 170, 34, '#6a5a3a');
    const regionNames = { 1: 'FILL A', 2: 'FILL B', 3: 'LINES', 4: 'SHADOW', 5: 'CLOUD' };
    [1, 2, 3, 4, 5].forEach((r, i) => {
      const c = run.piece.palette[r];
      rect(ctx, 172, 46 + i * 13, 9, 10, c.hex);
      text(ctx, c.name, 186, 48 + i * 13, '#4a4034');
      text(ctx, regionNames[r], 256, 48 + i * 13, '#8a7a5a');
    });
    drawCrewCorner(G, ctx);
    if (this.t > 1) centerText(ctx, '[ENTER] PICK THE SPOT', 182, '#fff');
  },
};

// ---- MAP -------------------------------------------------------------------

let bronxMap = null; // built once, kept for the whole session

const mapScene = {
  enter(G) {
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
      G.go('paint');
    }
  },
  draw(G, ctx) {
    ctx.drawImage(bronxMap, 0, 0);

    // spots
    this.spots.forEach((s, i) => {
      const col = s.kind === 'train' ? '#ff4070' : s.kind === 'gallery' ? '#c8c8d8' : '#ffd94a';
      const blink = Math.sin(this.t * 5 + i) > 0;
      rect(ctx, s.x - 1, s.y - 1, 3, 3, blink || i === this.sel ? col : '#6a6a55');
      if (i === this.sel) frame(ctx, s.x - 3, s.y - 3, 7, 7, col);
    });

    // reticle
    const rx = Math.round(this.retX), ry = Math.round(this.retY);
    frame(ctx, rx - 6, ry - 6, 13, 13, '#fff');
    rect(ctx, rx - 10, ry, 3, 1, '#fff'); rect(ctx, rx + 8, ry, 3, 1, '#fff');
    rect(ctx, rx, ry - 10, 1, 3, '#fff'); rect(ctx, rx, ry + 8, 1, 3, '#fff');

    // info bar lives BELOW the map — the borough stays clear
    const s = this.spots[this.sel];
    rect(ctx, 0, MAP_H, W, H - MAP_H, '#0d0d15');
    rect(ctx, 0, MAP_H, W, 1, '#32324a');
    text(ctx, s.name + (s.line ? ` (${s.line})` : ''), 6, 179, '#fff');
    text(ctx, 'DANGER ' + (s.danger ? '★'.repeat(s.danger) : 'NONE'), 216, 179, '#ff5030');
    text(ctx, s.kind === 'train' ? 'THE WHOLE CITY SEES A TRAIN. DOGS IN THE YARD.'
      : s.kind === 'gallery' ? 'SAFE AND WARM. NOBODY REAL SEES IT.'
      : 'A GOOD WALL. WATCH THE STREET.', 6, 190, '#8a8a96');
    if (Math.sin(this.t * 4) > -0.3) text(ctx, '[ENTER] GO', 254, 190, '#fff');
    drawCrewCorner(G, ctx);
  },
};

// ---- BOOK -------------------------------------------------------------------

const bookScene = {
  enter(G) { this.page = Math.max(0, Math.ceil(G.run.pieces.length / 2) - 1); },
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
    panel(ctx, 12, 12, 296, 160, '#efe9d8', '#8a7a5a');
    rect(ctx, 159, 14, 2, 156, '#c8bfa4');
    const entries = run.pieces.slice(this.page * 2, this.page * 2 + 2);
    entries.forEach((e, i) => {
      const x = 20 + i * 148;
      const spot = SPOTS.find(sp => sp.id === e.spotId);
      text(ctx, `NO.${e.id} ${spot.name}`, x, 18, '#4a4034');
      text(ctx, `W/ ${e.partnerTag}`, x, 29, '#a05030');
      ctx.drawImage(e.sketch, x, 40, 100, 37);
      ctx.drawImage(e.polaroid, x + 60, 80);
      // the check mark
      text(ctx, '✓', x + 108, 40, '#308030', 2);
      text(ctx, e.status === 'UP' ? 'STILL UP' : 'BUFFED', x, 86,
        e.status === 'UP' ? '#308030' : '#8a7a5a');
    });
    if (!run.pieces.length) centerText(ctx, 'NOTHING IN THE BOOK YET', 88, '#8a7a5a');
    text(ctx, `PAGE ${this.page + 1}`, 150, 162, '#8a7a5a');
    const n = run.pieces.length;
    centerText(ctx, `${n} BURNER${n === 1 ? '' : 'S'} UP   STRIKES ${run.strikes}/3`, 178, '#ffe040');
    centerText(ctx, 'ARROWS: FLIP   [ENTER] CLOSE THE BOOK', 190, '#888');
  },
};

// ---- BETWEEN NIGHTS ---------------------------------------------------------

const intermissionScene = {
  enter(G) {
    playBeat(hashStr('night') + level(G.run));
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
    dither(ctx, 0, 84, W, 20, '#2a1a30');
    for (let x = 0; x < W; x += 40) {
      const bh = x % 80 ? 8 : 0;
      rect(ctx, x, 96 + bh, 34, 108 - bh, '#16121e');
      for (let wy = 0; wy < 3; wy++) for (let wx = 0; wx < 3; wx++)
        if ((x + wy + wx) % 3) rect(ctx, x + 6 + wx * 9, 104 + bh + wy * 12, 4, 5, '#3a3020');
    }
    // water tower + antenna on the near roofs
    rect(ctx, 208, 82, 16, 12, '#241c18'); rect(ctx, 210, 79, 12, 3, '#2c221c');
    rect(ctx, 209, 94, 2, 4, '#241c18'); rect(ctx, 221, 94, 2, 4, '#241c18');
    rect(ctx, 132, 84, 1, 12, '#2a2a34'); rect(ctx, 128, 86, 9, 1, '#2a2a34');
    // your crew on the front roof, watching the city
    rect(ctx, 0, 172, W, 28, '#100c14');
    rect(ctx, 0, 172, W, 2, '#231a26');
    drawSpriteFlip(ctx, idleFrame(this.kid, this.t, 0), 22, 149, false);
    if (this.pal) drawSpriteFlip(ctx, idleFrame(this.pal, this.t, 1.2), 44, 149 + (Math.sin(this.t * 1.4) > 0.7 ? 1 : 0), false);
    // a pigeon keeping its distance
    const px = 76 + Math.floor(Math.sin(this.t * 0.7) * 3);
    rect(ctx, px, 168, 4, 3, '#8a8a96'); rect(ctx, px + 3, 166, 2, 2, '#8a8a96');
    if (Math.sin(this.t * 3.1) > 0.8) rect(ctx, px + 4, 165, 1, 1, '#8a8a96'); // peck

    const n = level(run);
    centerText(ctx, `NIGHT ${n + 1}`, 16, '#ffe040', 2);
    centerText(ctx, `${n} BURNER${n === 1 ? '' : 'S'} UP`, 42, '#fff');
    centerText(ctx, `STRIKES ${run.strikes}/3`, 54, run.strikes ? '#ff5030' : '#666');
    centerText(ctx, n >= 3 ? 'THE STREETS KNOW YOUR NAME. SO DO THE COPS.'
      : n >= 1 ? 'WORD IS GETTING AROUND.'
      : 'THE CITY DOESN\'T KNOW YOU YET.', 68, '#888');
    if (Math.sin(this.t * 4) > -0.3) centerText(ctx, '[ENTER] PAINT TONIGHT', 124, '#fff');
    centerText(ctx, '[B] FLIP THROUGH THE BOOK', 138, '#c0a060');
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
    centerText(ctx, 'THREE STRIKES.', 40, '#ff3030', 2);
    centerText(ctx, 'YOUR PARENTS PICK YOU UP FROM THE PRECINCT.', 66, '#c88');
    centerText(ctx, `${run.tag} GOT UP ${n} BURNER${n === 1 ? '' : 'S'}`, 96, '#ffe040', 1);
    if (this.isKing && n > 0) centerText(ctx, '*** NEW KING OF THE LINE ***', 120, '#40e050');
    centerText(ctx, 'BUT THE PIECES ARE STILL RUNNING...', 148, '#888');
    centerText(ctx, '[ENTER] BACK TO THE TITLE', 176, '#fff');
  },
};

export const SCENES = {
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
