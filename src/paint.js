// paint.js — the arcade heart: the paint scene and the result scene.

import { W, H, text, centerText, rect, frame, panel, meter, makeCanvas, drawSurface, makePolaroid } from './gfx.js';
import { COLORS, PED_LINES } from './data.js';
import { makeRng, pick, irange } from './rng.js';
import { makeKid, makeCop, makePedestrian, renderSketch } from './gen.js';
import { addPiece, pointsPerDay, difficulty } from './world.js';
import { sfxSpray, sfxSiren, sfxWhistle, sfxBust, sfxPop, sfxTick, playBeat } from './audio.js';

// Piece placement on screen
const PX = 40, PY = 34;

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export const paintScene = {
  enter(G) {
    const run = G.run;
    const piece = run.piece, spot = run.spot;
    const rng = makeRng(hashStr(run.tag + spot.id) ^ run.day);
    playBeat(hashStr('paint' + spot.id) + run.day);

    // Guide: sketch boundaries as faint chalk on the surface
    const [guide, gc] = makeCanvas(piece.w, piece.h);
    const sk = renderSketch(piece);
    const skd = sk.getContext('2d').getImageData(0, 0, piece.w, piece.h).data;
    const gimg = gc.createImageData(piece.w, piece.h);
    for (let i = 0; i < piece.w * piece.h; i++) {
      if (skd[i * 4] === 70) { // pencil pixels
        gimg.data[i * 4] = 255; gimg.data[i * 4 + 1] = 255;
        gimg.data[i * 4 + 2] = 255; gimg.data[i * 4 + 3] = 90;
      }
    }
    gc.putImageData(gimg, 0, 0);

    // Region pulse masks (highlight where the selected can belongs)
    const masks = {};
    for (const rid of [1, 2, 3, 4, 5]) {
      const [m, mc] = makeCanvas(piece.w, piece.h);
      const mi = mc.createImageData(piece.w, piece.h);
      for (let i = 0; i < piece.w * piece.h; i++) {
        if (piece.regions[i] === +rid) {
          mi.data[i * 4] = 255; mi.data[i * 4 + 1] = 255;
          mi.data[i * 4 + 2] = 255; mi.data[i * 4 + 3] = 255;
        }
      }
      mc.putImageData(mi, 0, 0);
      masks[rid] = m;
    }

    // The bag: the 5 colors the sketch needs + 2 decoys, shuffled
    const needed = [1, 2, 3, 4, 5].map(r => piece.palette[r]);
    const neededIds = new Set(needed.map(c => c.id));
    const decoys = COLORS.filter(c => !neededIds.has(c.id));
    const bag = [...needed, pick(rng, decoys), pick(rng, decoys.filter(d => d !== undefined))]
      .filter((c, i, a) => a.indexOf(c) === i);
    while (bag.length < 7) bag.push(pick(rng, decoys));
    for (let i = bag.length - 1; i > 0; i--) { // shuffle
      const j = Math.floor(rng() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    const st = run.stats, gear = run.gear, ptag = run.partner.tag;
    const totalRegion = Object.values(piece.counts).reduce((a, b) => a + b, 0);
    const paintCap = Math.round(totalRegion * (1.8 + st.rack * 0.25 + gear.paint * 0.3));

    const diff = difficulty(run);
    let radius = 2;
    if (st.cans >= 5) radius++;
    if (ptag === 'SABLE' || ptag === 'CRISPO 149') radius++;
    if (ptag === 'TEKO 5') radius += 2;
    radius += Math.floor(gear.paint / 2);

    let heatRate = 3.5 + spot.heat * 1.1 + diff * 0.25 - st.creep * 0.7;
    if (ptag === 'MERC ONE' && spot.kind === 'train') heatRate *= 0.6;
    heatRate = Math.max(1.2, heatRate);

    this.s = {
      rng, piece, spot, guide, masks, bag,
      covered: new Uint8Array(piece.w * piece.h),
      coveredCount: 0,
      totalRegion,
      painted: new Uint8Array(piece.w * piece.h), // color id currently on each pixel
      paintCv: makeCanvas(piece.w, piece.h),
      selected: 0,
      paint: paintCap, paintCap,
      cost: Math.max(0.5, 1 - st.cans * 0.06 - gear.paint * 0.08), // paint per pixel
      last: null, // previous spray point, for stroke interpolation
      radius,
      tol: 1 + Math.floor(st.sketch / 2),
      timeLeft: Math.max(40, spot.time - diff * 4),
      heat: 0, heatRate,
      hiding: false,
      cop: null,          // {x, dir, stay, exposeT}
      warned: false,
      ped: null,          // {x, dir, line, t, sprite}
      pedTimer: 5 + rng() * 6,
      msg: '[1-7] CANS · [SPACE] HIDE · [ENTER] DONE',
      msgT: 5,
      spraying: false,
      busted: false, bustedT: 0,
      done: false,
      lowTick: 0,
      kid: makeKid(hashStr(G.run.tag), hashStr(G.run.tag) % 360),
      copSprite: makeCop(hashStr(spot.id)),
      copStay: Math.max(2.5, 6 - st.dash * 0.35 - gear.kicks * 0.35),
      bustGrace: 1.2 + st.dash * 0.2 + gear.kicks * 0.3,
      pulse: 0,
    };
  },

  update(G, dt) {
    const s = this.s;
    if (s.busted) {
      s.bustedT += dt;
      if (s.bustedT > 2.5) {
        sfxSpray(false);
        G.run.strikes++;
        G.go(G.run.strikes >= 3 ? 'gameover' : 'intermission');
      }
      return;
    }
    if (s.done) return;
    s.pulse += dt * 6;
    s.timeLeft -= dt;
    s.msgT -= dt;

    // last-seconds tick
    if (s.timeLeft < 6 && s.timeLeft > 0) {
      s.lowTick -= dt;
      if (s.lowTick <= 0) { sfxTick(); s.lowTick = 1; }
    }
    if (s.timeLeft <= 0) { finishPiece(G, this); return; }

    // spraying
    const m = G.mouse;
    const overPiece = m.x >= PX && m.x < PX + s.piece.w && m.y >= PY && m.y < PY + s.piece.h;
    const wantSpray = m.down && overPiece && !s.hiding && s.paint > 0;
    if (wantSpray) spray(s, m.x - PX, m.y - PY);
    else s.last = null;
    if (wantSpray !== s.spraying) { s.spraying = wantSpray; sfxSpray(wantSpray); }

    // heat
    s.heat += (s.spraying ? s.heatRate : s.heatRate * 0.12) * dt;

    // KWIK early warning
    if (!s.warned && s.heat >= 82 && G.run.partner.tag === 'KWIK 12' && !s.cop) {
      s.warned = true;
      sfxWhistle();
      say(s, 'KWIK WHISTLES: 5-0 COMING!');
    }

    // cop spawn
    if (s.heat >= 100 && !s.cop) {
      s.cop = { x: W + 10, stay: s.copStay, exposeT: 0, leaving: false };
      sfxSiren();
      say(s, '5-0!! HIDE!! [HOLD SPACE]');
    }
    if (s.cop) {
      const c = s.cop;
      if (!c.leaving) {
        if (c.x > 240) c.x -= 40 * dt;
        else {
          c.stay -= dt;
          if (c.stay <= 0) { c.leaving = true; say(s, 'HE\'S GONE. BACK TO WORK.'); }
        }
        // exposure check once he's close
        if (c.x < 290) {
          if (s.hiding) c.exposeT = 0;
          else {
            c.exposeT += dt;
            if (c.exposeT > s.bustGrace) return bust(G, this);
          }
        }
      } else {
        c.x += 55 * dt;
        if (c.x > W + 12) { s.cop = null; s.warned = false; s.heat = 45; }
      }
    }

    // pedestrians
    s.pedTimer -= dt;
    if (s.pedTimer <= 0 && !s.ped && s.spot.kind !== 'gallery') {
      const dir = s.rng() < 0.5 ? 1 : -1;
      s.ped = {
        x: dir === 1 ? -14 : W + 14, dir,
        line: pick(s.rng, PED_LINES), spoke: false,
        sprite: makePedestrian(irange(s.rng, 0, 1e9)),
      };
      s.pedTimer = 8 + s.rng() * 8;
    }
    if (s.ped) {
      const p = s.ped;
      p.x += p.dir * 26 * dt;
      if (!p.spoke && Math.abs(p.x - W / 2) < 30) {
        p.spoke = true;
        say(s, `"${p.line}"`);
        if (p.line.includes('COPS') || p.line.includes('HOODLUMS')) s.heat += 14;
        else s.heat += 5;
      }
      if (p.x < -16 || p.x > W + 16) s.ped = null;
    }
  },

  key(G, e) {
    const s = this.s;
    if (s.busted || s.done) return;
    if (e.type === 'down') {
      if (e.key === ' ') { s.hiding = true; sfxSpray(false); s.spraying = false; }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= s.bag.length) s.selected = n - 1;
      if (e.key === 'Enter') finishPiece(G, this);
    } else if (e.key === ' ') {
      s.hiding = false;
    }
  },

  click(G, x, y) {
    // can selection by clicking the bag
    const s = this.s;
    const i = Math.floor((x - 26) / 40);
    if (y >= 168 && y <= 196 && i >= 0 && i < s.bag.length) s.selected = i;
  },

  draw(G, ctx) {
    const s = this.s, run = G.run;
    // night sky + ground
    rect(ctx, 0, 0, W, H, s.spot.kind === 'gallery' ? '#2a2a30' : '#0c0c1e');
    if (s.spot.kind !== 'gallery') {
      ctx.fillStyle = '#f0e8b0';
      const srng = makeRng(42);
      for (let i = 0; i < 30; i++) ctx.fillRect(Math.floor(srng() * W), Math.floor(srng() * 26), 1, 1);
    }
    rect(ctx, 0, 140, W, 60, '#16161c');
    rect(ctx, 0, 140, W, 2, '#26262e');

    drawSurface(ctx, 28, 26, 264, 106, s.spot.kind, makeRng(7));
    ctx.drawImage(s.guide, PX, PY);
    ctx.drawImage(s.paintCv[0], PX, PY);

    // pulse the region the selected can belongs to
    const sel = s.bag[s.selected];
    const rid = Object.keys(s.piece.palette).find(r => s.piece.palette[r].id === sel.id);
    if (rid) {
      ctx.globalAlpha = 0.10 + 0.08 * Math.sin(s.pulse);
      ctx.drawImage(s.masks[rid], PX, PY);
      ctx.globalAlpha = 1;
    }

    // dumpster (your hiding spot)
    rect(ctx, 6, 118, 26, 20, '#2a4a34');
    rect(ctx, 6, 116, 26, 3, '#1d3625');
    text(ctx, 'XX', 12, 122, '#16281c');

    // the kid: hiding behind the dumpster, or painting at the mouse
    if (s.hiding) {
      ctx.drawImage(s.kid, 12, 108);
      text(ctx, '!', 20, 96, '#ffe040');
    } else if (!s.busted) {
      const kx = Math.max(30, Math.min(280, G.mouse.x - 7));
      ctx.drawImage(s.kid, kx, 118);
      rect(ctx, kx + (G.mouse.x > kx + 7 ? 14 : -3), 122, 2, 4, sel.hex); // can in hand
    }

    if (s.ped) ctx.drawImage(s.ped.sprite, Math.round(s.ped.x), 140);
    if (s.cop) {
      ctx.drawImage(s.copSprite, Math.round(s.cop.x), 138);
      if (!s.cop.leaving && s.cop.x <= 290) {
        const flash = Math.sin(s.pulse * 2) > 0;
        text(ctx, 'HIDE!', Math.round(s.cop.x) - 8, 128, flash ? '#ff3030' : '#ffe040');
      }
    }

    // HUD
    const frac = s.coveredCount / s.totalRegion;
    text(ctx, `${Math.ceil(s.timeLeft)}`, 8, 4, s.timeLeft < 15 ? '#ff4040' : '#fff', 2);
    meter(ctx, 56, 6, 56, 7, s.heat / 100, s.heat > 80 ? '#ff3030' : '#ff8830');
    text(ctx, 'HEAT', 58, 14, '#888');
    meter(ctx, 122, 6, 56, 7, frac, frac >= 0.6 ? '#40cc50' : '#cccc40');
    text(ctx, `PIECE ${Math.floor(frac * 100)}%`, 124, 14, '#888');
    drawCrewCorner(G, ctx);

    // bag of cans
    panel(ctx, 20, 164, 280, 34, '#101018', '#3a3a52');
    for (let i = 0; i < s.bag.length; i++) {
      const cx = 26 + i * 40;
      const isSel = i === s.selected;
      if (isSel) frame(ctx, cx - 2, 166, 36, 30, '#fff');
      rect(ctx, cx + 2, 170, 10, 18, s.bag[i].hex);
      rect(ctx, cx + 4, 168, 6, 2, '#999');
      text(ctx, String(i + 1), cx + 16, 170, isSel ? '#fff' : '#777');
    }
    // shared paint meter, under the clock
    meter(ctx, 8, 24, 44, 6, s.paint / s.paintCap, '#40a0e0');
    text(ctx, 'PAINT', 8, 31, '#888');

    if (s.msgT > 0) centerText(ctx, s.msg, 148, '#ffe040');

    if (s.busted) {
      rect(ctx, 0, 70, W, 50, '#600');
      centerText(ctx, 'BUSTED!', 78, '#fff', 2);
      centerText(ctx, `STRIKE ${run.strikes + 1} OF 3 — PIECE LOST`, 104, '#fcc');
    }
  },
};

function say(s, msg) { s.msg = msg; s.msgT = 3.5; }

// Stamp a filled disc along the mouse stroke, like a real can laying a line.
function spray(s, mx, my) {
  const color = s.bag[s.selected];
  const ctx = s.paintCv[1];
  const w = s.piece.w, h = s.piece.h, r = s.radius;
  ctx.fillStyle = color.hex;
  const from = s.last || [mx, my];
  const dist = Math.hypot(mx - from[0], my - from[1]);
  const steps = Math.max(1, Math.min(40, Math.ceil(dist / 2)));
  for (let n = 0; n < steps; n++) {
    const t = n / steps;
    const cx = Math.round(from[0] + (mx - from[0]) * t);
    const cy = Math.round(from[1] + (my - from[1]) * t);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 0 || x >= w || y < 0 || y >= h) continue;
        const i = y * w + x;
        if (s.painted[i] === color.id) continue; // already this color
        if (s.paint <= 0) { s.last = [mx, my]; return; }
        s.paint -= s.cost;
        s.painted[i] = color.id;
        ctx.fillRect(x, y, 1, 1);
        if (!s.covered[i] && wantsColor(s, x, y, color.id)) {
          s.covered[i] = 1;
          s.coveredCount++;
        } else if (s.covered[i]) {
          const reg = s.piece.regions[i];
          if (reg && s.piece.palette[reg].id !== color.id) {
            s.covered[i] = 0; // sprayed over your own good work
            s.coveredCount--;
          }
        }
      }
    }
  }
  s.last = [mx, my];
}

// SKETCH skill tolerance: a near-miss still counts if the right region
// is within `tol` pixels.
function wantsColor(s, x, y, colorId) {
  const w = s.piece.w, h = s.piece.h, t = s.tol;
  for (let dy = -t; dy <= t; dy += t || 1) {
    for (let dx = -t; dx <= t; dx += t || 1) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const r = s.piece.regions[ny * w + nx];
      if (r && s.piece.palette[r].id === colorId) return true;
    }
  }
  return false;
}

function bust(G, scene) {
  const s = scene.s;
  s.busted = true;
  s.bustedT = 0;
  sfxSpray(false);
  sfxBust();
}

function finishPiece(G, scene) {
  const s = scene.s;
  if (s.done || s.busted) return;
  s.done = true;
  sfxSpray(false);
  const frac = s.coveredCount / s.totalRegion;
  G.mission = {
    coverage: frac,
    paintCv: s.paintCv[0],
    spot: s.spot,
  };
  G.go('result');
}

export const resultScene = {
  enter(G) {
    const run = G.run, m = G.mission;
    let quality = m.coverage;
    if (run.partner.tag === 'LADY VEX') quality = Math.min(1, quality + 0.1);
    const flopped = m.coverage < 0.6;
    if (flopped) quality *= 0.4;

    // compose the finished wall for the polaroid
    const [comp, cc] = makeCanvas(264, 106);
    drawSurface(cc, 0, 0, 264, 106, m.spot.kind, makeRng(7));
    cc.drawImage(m.paintCv, PX - 28, PY - 26);
    const polaroid = makePolaroid(comp, 0, 0, 264, 106);
    const sketch = renderSketch(run.piece);

    const entry = addPiece(run, {
      spotId: m.spot.id, quality,
      sketch, polaroid, partnerTag: run.partner.tag,
    });
    this.s = { comp, polaroid, entry, flopped, quality, t: 0 };
    sfxPop();
  },

  update(G, dt) { this.s.t += dt; },

  key(G, e) {
    if (e.type === 'down' && e.key === 'Enter' && this.s.t > 1) {
      G.bookReturn = 'intermission';
      G.pendingAdvance = true;
      G.go('book');
    }
  },

  draw(G, ctx) {
    const s = this.s, run = G.run;
    rect(ctx, 0, 0, W, H, '#0c0c1e');
    ctx.drawImage(s.comp, 28, 20);
    // polaroid drops in
    const py = Math.min(120, -60 + s.t * 260);
    ctx.drawImage(s.polaroid, 236, py);
    text(ctx, 'CLICK.', 244, py + 60, '#888');

    if (s.flopped) {
      centerText(ctx, 'TIME. IT\'S A TOY PIECE...', 140, '#ff8040', 1);
      centerText(ctx, 'BARELY WORTH THE PAINT.', 152, '#ff8040', 1);
    } else {
      centerText(ctx, 'UP!', 136, '#40e050', 2);
      centerText(ctx, `QUALITY ${Math.floor(s.quality * 100)}% — EARNS ${pointsPerDay(run, s.entry)}/DAY WHILE IT RUNS`, 158, '#ccc');
    }
    if (s.t > 1) centerText(ctx, '[ENTER] THE BOOK', 182, '#ffe040');
  },
};

export function drawCrewCorner(G, ctx) {
  const run = G.run;
  if (!run || !run.partner) return;
  const label = `${run.tag} + ${run.partner.tag}`;
  const wpx = Math.min(140, label.length * 6 + 22);
  panel(ctx, W - wpx - 4, 2, wpx, 14, '#101018', '#3a3a52');
  text(ctx, label, W - wpx + 12, 4, '#ffe040');
  ctx.fillStyle = '#ffe040';
  ctx.fillRect(W - wpx + 2, 6, 5, 5);
  ctx.fillRect(W - wpx + 4, 4, 1, 9);
}
