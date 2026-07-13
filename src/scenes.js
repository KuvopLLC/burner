// scenes.js — everything around the paint scene: title, tag entry, skills,
// the partner tumbler, the sketch, the Bronx map, the black book,
// the between-nights breather, game over.

import { W, H, text, textWidth, centerText, rect, frame, panel, dither } from './gfx.js';
import { SKILLS, SKILL_POINTS, PARTNERS, SPOTS } from './data.js';
import { makeRng, irange } from './rng.js';
import { makePiece, renderPiece, renderSketch, makeKid } from './gen.js';
import { newRun, availableSpots, level, loadHighScores, saveHighScore } from './world.js';
import { paintScene, resultScene, drawCrewCorner } from './paint.js';
import { buildBronxMap, MAP_H } from './bronx.js';
import { playBeat, stopBeat, sfxPop, sfxTick } from './audio.js';

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
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
    this.t = 0;
    this.hs = loadHighScores();
  },
  update(G, dt) {
    this.t += dt;
    for (const d of this.drips) if (d.y - 70 < d.len) d.y += d.sp * dt;
  },
  key(G, e) {
    if (e.type === 'down' && e.key === 'Enter') G.go('name');
  },
  draw(G, ctx) {
    rect(ctx, 0, 0, W, H, '#0c0c1e');
    // el track silhouette
    rect(ctx, 0, 160, W, 3, '#1e1e2c');
    for (let x = 8; x < W; x += 22) rect(ctx, x, 163, 4, 37, '#1e1e2c');
    centerText(ctx, 'KUVOP PRESENTS', 26, '#666');
    centerText(ctx, 'BURNER', 42, '#ff3060', 4);
    ctx.fillStyle = '#ff3060';
    for (const d of this.drips) ctx.fillRect(Math.round(d.x), 70, 2, Math.round(d.y - 70) + 2);
    centerText(ctx, 'GET UP. STAY UP.', 100, '#ffe040');
    if (this.hs.length) {
      centerText(ctx, '-- KINGS OF THE LINE --', 118, '#888');
      this.hs.slice(0, 4).forEach((h, i) => {
        centerText(ctx, `${h.tag}  ${h.piecesUp} UP`, 128 + i * 10, i === 0 ? '#ffe040' : '#aaa');
      });
    } else {
      centerText(ctx, 'ARROWS + ENTER: MENUS   MOUSE: PAINT', 124, '#888');
      centerText(ctx, '1-7: CANS   SPACE: HIDE FROM COPS', 136, '#888');
    }
    if (Math.sin(this.t * 4) > -0.2) centerText(ctx, '[ENTER] START WRITING', 174, '#fff');
  },
};

// ---- NAME -----------------------------------------------------------------

const nameScene = {
  enter() { this.tag = ''; this.t = 0; },
  update(G, dt) { this.t += dt; },
  key(G, e) {
    if (e.type !== 'down') return;
    const k = e.key.toUpperCase();
    if (/^[A-Z0-9]$/.test(k) && this.tag.length < 8) { this.tag += k; sfxTick(); }
    if (e.key === 'Backspace') this.tag = this.tag.slice(0, -1);
    if (e.key === 'Enter' && this.tag.length >= 2) {
      G.pendingTag = this.tag;
      G.go('skills');
    }
  },
  draw(G, ctx) {
    rect(ctx, 0, 0, W, H, '#0c0c1e');
    centerText(ctx, 'EVERY WRITER NEEDS A NAME', 40, '#888');
    centerText(ctx, 'WRITE YOUR TAG', 54, '#fff', 2);
    const shown = this.tag + (Math.sin(this.t * 6) > 0 ? '_' : ' ');
    centerText(ctx, shown, 96, '#ffe040', 3);
    centerText(ctx, '2-8 LETTERS. SHORT NAMES GO UP FASTER.', 150, '#888');
    if (this.tag.length >= 2) centerText(ctx, '[ENTER] THAT\'S ME', 170, '#fff');
  },
};

// ---- SKILLS ---------------------------------------------------------------

const skillsScene = {
  enter(G) {
    this.vals = {};
    for (const s of SKILLS) this.vals[s.key] = 1;
    this.left = SKILL_POINTS;
    this.sel = 0;
  },
  key(G, e) {
    if (e.type !== 'down') return;
    const k = SKILLS[this.sel].key;
    if (e.key === 'ArrowUp') this.sel = (this.sel + SKILLS.length - 1) % SKILLS.length;
    if (e.key === 'ArrowDown') this.sel = (this.sel + 1) % SKILLS.length;
    if (e.key === 'ArrowRight' && this.left > 0 && this.vals[k] < 6) { this.vals[k]++; this.left--; sfxTick(); }
    if (e.key === 'ArrowLeft' && this.vals[k] > 1) { this.vals[k]--; this.left++; sfxTick(); }
    if (e.key === 'Enter' && this.left === 0) {
      const seed = hashStr(G.pendingTag) ^ Date.now();
      G.run = newRun(G.pendingTag, { ...this.vals }, seed >>> 0);
      G.go('partner');
    }
  },
  draw(G, ctx) {
    rect(ctx, 0, 0, W, H, '#0c0c1e');
    centerText(ctx, `${G.pendingTag} — WHO ARE YOU OUT THERE?`, 12, '#fff');
    centerText(ctx, `POINTS LEFT: ${this.left}`, 26, this.left ? '#ffe040' : '#40e050');
    SKILLS.forEach((s, i) => {
      const y = 44 + i * 18;
      const isSel = i === this.sel;
      if (isSel) rect(ctx, 40, y - 2, 240, 14, '#1c1c30');
      text(ctx, s.name, 48, y, isSel ? '#ffe040' : '#ccc');
      for (let p = 0; p < 6; p++) {
        rect(ctx, 110 + p * 14, y + 1, 10, 8, p < this.vals[s.key] ? '#ff3060' : '#26263a');
      }
      text(ctx, String(this.vals[s.key]), 200 + 8, y, '#fff');
    });
    centerText(ctx, SKILLS[this.sel].desc, 160, '#888');
    centerText(ctx, this.left === 0 ? '[ENTER] HIT THE STREET' : 'ARROWS TO SPEND YOUR POINTS', 178,
      this.left === 0 ? '#fff' : '#666');
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
      ctx.drawImage(this.sprites[idx], rx + 8, yOff);
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
    run.piece = makePiece(run.tag, seed);
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
  },
  key(G, e) {
    if (e.type !== 'down') return;
    if (e.key === 'Enter') { G.run.partner = null; G.go('partner'); }
    if (e.key === 'b' || e.key === 'B') { G.bookReturn = 'intermission'; G.go('book'); }
  },
  draw(G, ctx) {
    const run = G.run;
    rect(ctx, 0, 0, W, H, '#0c0c1e');
    // dusk over rooftops
    dither(ctx, 0, 0, W, 40, '#2a1a30');
    for (let x = 0; x < W; x += 40) {
      rect(ctx, x, 46 + (x % 80 ? 8 : 0), 34, 60 - (x % 80 ? 8 : 0), '#16121e');
      for (let wy = 0; wy < 3; wy++) for (let wx = 0; wx < 3; wx++)
        if ((x + wy + wx) % 3) rect(ctx, x + 6 + wx * 9, 54 + wy * 12, 4, 5, '#3a3020');
    }
    const n = level(run);
    centerText(ctx, `NIGHT ${n + 1}`, 20, '#ffe040', 2);
    centerText(ctx, `${n} BURNER${n === 1 ? '' : 'S'} UP`, 48, '#fff');
    centerText(ctx, `STRIKES ${run.strikes}/3`, 60, run.strikes ? '#ff5030' : '#666');
    centerText(ctx, n >= 3 ? 'THE STREETS KNOW YOUR NAME. SO DO THE COPS.'
      : n >= 1 ? 'WORD IS GETTING AROUND.'
      : 'THE CITY DOESN\'T KNOW YOU YET.', 82, '#888');
    centerText(ctx, '[ENTER] PAINT TONIGHT', 130, '#fff', 1);
    centerText(ctx, '[B] FLIP THROUGH THE BOOK', 152, '#c0a060');
  },
};

// ---- GAME OVER -----------------------------------------------------------------

const gameoverScene = {
  enter(G) {
    stopBeat();
    const run = G.run;
    const n = level(run);
    this.hs = saveHighScore(run.tag, n);
    this.isKing = this.hs.length && this.hs[0].tag === run.tag && this.hs[0].piecesUp === n;
  },
  key(G, e) {
    if (e.type === 'down' && e.key === 'Enter') G.go('title');
  },
  draw(G, ctx) {
    const run = G.run;
    const n = level(run);
    rect(ctx, 0, 0, W, H, '#180808');
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
  skills: skillsScene,
  partner: partnerScene,
  sketch: sketchScene,
  map: mapScene,
  paint: paintScene,
  result: resultScene,
  book: bookScene,
  intermission: intermissionScene,
  gameover: gameoverScene,
};
