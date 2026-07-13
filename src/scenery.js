// scenery.js — the world around the wall. Each spot kind gets a full
// scene: a pre-rendered backdrop plus living details — twinkling stars,
// window lights, traffic, a guy by the trash can working on a bottle,
// kids hanging out with a boombox, a slow security guard, a gallery
// manager in a beret. The street is never empty.

import { W, H, rect, frame, text, makeCanvas, drawSurface } from './gfx.js';
import { makeRng, irange } from './rng.js';
import { makeKid, makePedestrian, makeGuard, makeManager } from './gen.js';
import { sfxWhoosh, sfxClink } from './audio.js';

// piece surface position (matches paint.js)
const SX = 28, SY = 26, SW = 264, SH = 106;

export function drawSpriteFlip(ctx, cv, x, y, flip) {
  if (flip) {
    ctx.save();
    ctx.translate(Math.round(x) + cv.width, Math.round(y));
    ctx.scale(-1, 1);
    ctx.drawImage(cv, 0, 0);
    ctx.restore();
  } else {
    ctx.drawImage(cv, Math.round(x), Math.round(y));
  }
}

// idle frame with a natural blink
export function idleFrame(frames, t, phase = 0) {
  return frames.idle[((t + phase) % 3.4) < 0.13 ? 1 : 0];
}

export function walkFrame(frames, t) {
  return frames.walk[Math.floor(t * 5) % 2];
}

export function makeScenery(kind, seed, line) {
  const rng = makeRng(seed);
  const [bd, bc] = makeCanvas(W, H);

  // seeded star field with per-star twinkle phase
  const stars = [];
  const starBand = kind === 'gallery' ? null : { y0: 0, y1: kind === 'train' ? 15 : 13 };
  if (starBand) {
    for (let i = 0; i < 26; i++) {
      stars.push({
        x: Math.floor(rng() * W), y: starBand.y0 + Math.floor(rng() * (starBand.y1 - starBand.y0)),
        ph: rng() * 6.28, sp: 1.5 + rng() * 2.5, big: rng() < 0.18,
      });
    }
  }

  const state = { kind, rng, stars, t: 0, actors: {}, line };

  if (kind === 'train') buildYard(bd, bc, state);
  else if (kind === 'gallery') buildGallery(bd, bc, state);
  else buildStreet(bd, bc, state);

  return {
    backdrop: bd,
    update(dt) { state.t += dt; (state.tick || (() => {}))(dt); },
    draw(ctx) {
      ctx.drawImage(bd, 0, 0);
      drawStars(ctx, state);
      (state.drawDyn || (() => {}))(ctx);
    },
  };
}

function drawStars(ctx, st) {
  ctx.fillStyle = '#f0e8b0';
  for (const s of st.stars) {
    const tw = Math.sin(st.t * s.sp + s.ph);
    if (tw < -0.2) continue;
    ctx.globalAlpha = 0.35 + tw * 0.55;
    ctx.fillRect(s.x, s.y, 1, 1);
    if (s.big && tw > 0.75) { // a proper twinkle flare
      ctx.fillRect(s.x - 1, s.y, 1, 1); ctx.fillRect(s.x + 1, s.y, 1, 1);
      ctx.fillRect(s.x, s.y - 1, 1, 1); ctx.fillRect(s.x, s.y + 1, 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}

// ---- THE STREET CORNER ------------------------------------------------------

function buildStreet(bd, c, st) {
  const rng = st.rng;
  // sky
  rect(c, 0, 0, W, 14, '#0b0b1c');
  // water tower on the roofline
  rect(c, 248, 4, 14, 8, '#241c18'); rect(c, 250, 2, 10, 2, '#2c221c');
  rect(c, 249, 12, 2, 3, '#241c18'); rect(c, 259, 12, 2, 3, '#241c18');
  // tv antenna
  rect(c, 60, 5, 1, 9, '#2a2a34'); rect(c, 56, 6, 9, 1, '#2a2a34'); rect(c, 58, 9, 5, 1, '#2a2a34');
  // the building the wall belongs to: a floor of windows above
  rect(c, 0, 14, W, 12, '#31201b');
  rect(c, 0, 14, W, 1, '#191219');
  st.windows = [];
  for (let wx = 12; wx < W - 14; wx += 26) {
    const lit = rng() < 0.35;
    st.windows.push({ x: wx, y: 16, w: 9, h: 8, lit, next: 4 + rng() * 14 });
    if (rng() < 0.3) rect(c, wx + 12, 20, 6, 4, '#3d2c24'); // AC unit
  }
  // side walls beyond the paintable wall + drainpipe
  rect(c, 0, 26, SX, SH, '#241a16');
  rect(c, SX + SW, 26, W - SX - SW, SH, '#241a16');
  rect(c, 18, 26, 3, 106, '#2e2620'); rect(c, 17, 40, 5, 2, '#241c18'); rect(c, 17, 90, 5, 2, '#241c18');
  // the wall itself
  drawSurface(c, SX, SY, SW, SH, 'wall', rng);
  // sidewalk, curb, road
  rect(c, 0, 132, W, 8, '#3c3c44');
  for (let sx = 0; sx < W; sx += 24) rect(c, sx, 132, 1, 8, '#30303a');
  rect(c, 0, 140, W, 3, '#26262e');
  rect(c, 0, 143, W, 57, '#1b1b21');
  ctx_dashes(c);
  // streetlight poles flanking the wall, cones drawn dynamic
  for (const px of [24, 296]) {
    rect(c, px, 70, 2, 62, '#383840');
    rect(c, px - (px > W / 2 ? 6 : -2) + (px > W / 2 ? 0 : 4), 70, 8, 2, '#383840');
    const lx = px > W / 2 ? px - 7 : px + 9;
    rect(c, lx, 71, 4, 3, '#ffe9a0');
  }
  // hydrant
  rect(c, 282, 150, 5, 8, '#8a2820'); rect(c, 283, 148, 3, 2, '#8a2820');
  rect(c, 281, 152, 7, 2, '#8a2820');
  // trash can + empties
  rect(c, 300, 146, 11, 13, '#4a4e58'); rect(c, 299, 144, 13, 3, '#3c404a');
  rect(c, 301, 148, 2, 9, '#3e424c');
  rect(c, 296, 156, 2, 4, '#7a5c28'); rect(c, 313, 157, 2, 3, '#3a5c38'); // bottles
  // parked car
  const hue = irange(rng, 0, 359);
  rect(c, 58, 148, 52, 10, `hsl(${hue},30%,30%)`);
  rect(c, 64, 144, 36, 5, `hsl(${hue},30%,24%)`);
  rect(c, 67, 145, 13, 3, '#1a2028'); rect(c, 83, 145, 13, 3, '#1a2028');
  rect(c, 62, 156, 8, 5, '#101014'); rect(c, 96, 156, 8, 5, '#101014');
  rect(c, 64, 158, 3, 2, '#3c4048'); rect(c, 98, 158, 3, 2, '#3c4048');
  rect(c, 57, 151, 2, 2, '#c8d0d8'); rect(c, 109, 151, 2, 2, '#b03030');

  // ---- living pieces ----
  const kidA = makeKid(irange(rng, 0, 1e9), irange(rng, 0, 359));
  const kidB = makeKid(irange(rng, 0, 1e9), irange(rng, 0, 359));
  const drinker = makePedestrian(irange(rng, 0, 1e9));
  st.actors = {
    cars: [], carNext: 4 + rng() * 6,
    notes: [], noteNext: 1,
    bottleUp: 0, bottleNext: 5 + rng() * 5,
    kidA, kidB, drinker,
  };

  st.tick = dt => {
    const a = st.actors;
    // window lights flick on and off across the night
    for (const w of st.windows) {
      w.next -= dt;
      if (w.next <= 0) { w.lit = !w.lit; w.next = 6 + st.rng() * 20; }
    }
    // traffic
    a.carNext -= dt;
    if (a.carNext <= 0) {
      const dir = st.rng() < 0.5 ? 1 : -1;
      a.cars.push({ x: dir === 1 ? -40 : W + 40, dir, sp: 55 + st.rng() * 35, hue: irange(st.rng, 0, 359) });
      a.carNext = 6 + st.rng() * 9;
      sfxWhoosh();
    }
    for (const car of a.cars) car.x += car.dir * car.sp * dt;
    a.cars = a.cars.filter(car => car.x > -60 && car.x < W + 60);
    // boombox notes
    a.noteNext -= dt;
    if (a.noteNext <= 0) { a.notes.push({ x: 86 + st.rng() * 6, y: 140, vy: 9 + st.rng() * 4, t: 0 }); a.noteNext = 1 + st.rng() * 0.8; }
    for (const n of a.notes) { n.y -= n.vy * dt; n.t += dt; }
    a.notes = a.notes.filter(n => n.t < 1.6);
    // the guy by the trash can
    a.bottleNext -= dt;
    if (a.bottleNext <= 0) { a.bottleUp = 1.2; a.bottleNext = 6 + st.rng() * 7; }
    if (a.bottleUp > 0) a.bottleUp -= dt;
  };

  st.drawDyn = ctx => {
    const a = st.actors, t = st.t;
    // windows
    for (const w of st.windows) rect(ctx, w.x, w.y, w.w, w.h, w.lit ? '#c8a04a' : '#1c1518');
    for (const w of st.windows) { rect(ctx, w.x + 4, w.y, 1, w.h, '#00000030'); }
    // streetlight glow cones (breathe a little)
    for (const px of [24, 296]) {
      const lx = px > W / 2 ? px - 7 : px + 9;
      const flick = 0.05 + 0.02 * Math.sin(t * 2.2 + px);
      ctx.fillStyle = '#ffe9a0';
      for (let step = 0; step < 5; step++) {
        ctx.globalAlpha = flick * (1 - step / 5);
        const sw = 6 + step * 5;
        rect(ctx, lx + 2 - sw / 2, 74 + step * 12, sw, 12, '#ffe9a0');
      }
      ctx.globalAlpha = 1;
    }
    // moving cars
    for (const car of a.cars) {
      const cx = Math.round(car.x);
      rect(ctx, cx, 149, 40, 9, `hsl(${car.hue},32%,26%)`);
      rect(ctx, cx + 6, 145, 26, 5, `hsl(${car.hue},32%,20%)`);
      rect(ctx, cx + 8, 146, 9, 3, '#161c26'); rect(ctx, cx + 20, 146, 9, 3, '#161c26');
      rect(ctx, cx + 4, 156, 7, 4, '#0c0c10'); rect(ctx, cx + 29, 156, 7, 4, '#0c0c10');
      const hx = car.dir === 1 ? cx + 39 : cx - 1;
      rect(ctx, hx, 151, 2, 2, '#ffefc0');
      ctx.globalAlpha = 0.16;
      rect(ctx, car.dir === 1 ? cx + 41 : cx - 15, 150, 14, 4, '#ffefc0');
      ctx.globalAlpha = 1;
      rect(ctx, car.dir === 1 ? cx - 1 : cx + 39, 151, 2, 2, '#c03030');
    }
    // hangout kids by the parked car + boombox on the hood
    drawSpriteFlip(ctx, idleFrame(a.kidA, t, 0), 68, 122 + (Math.sin(t * 2.1) > 0.6 ? 1 : 0), false);
    drawSpriteFlip(ctx, idleFrame(a.kidB, t, 1.4), 90, 122 + (Math.sin(t * 1.7 + 2) > 0.6 ? 1 : 0), true);
    rect(ctx, 82, 138, 12, 7, '#22242c');
    rect(ctx, 83, 139, 3, 3, '#3a3e48'); rect(ctx, 90, 139, 3, 3, '#3a3e48');
    rect(ctx, 84 + Math.floor((Math.sin(t * 6) + 1) * 1.5), 143, 1, 1, '#ffe040'); // vu light
    rect(ctx, 86, 137, 4, 1, '#3a3e48');
    // notes
    for (const n of a.notes) {
      ctx.globalAlpha = Math.max(0, 1 - n.t / 1.6);
      text(ctx, '♪', Math.round(n.x + Math.sin(n.t * 5) * 3), Math.round(n.y), '#ffe040');
      ctx.globalAlpha = 1;
    }
    // the drinker, holding it down by the trash can
    const sway = Math.sin(t * 0.9) > 0.7 ? 1 : 0;
    drawSpriteFlip(ctx, idleFrame(a.drinker, t, 2.2), 306 + sway, 138, true);
    const up = a.bottleUp > 0;
    rect(ctx, up ? 304 : 302, up ? 144 : 152, 2, 5, '#8a6428');
    rect(ctx, up ? 304 : 302, up ? 142 : 150, 2, 2, '#5c421c');
  };
}

function ctx_dashes(c) {
  for (let dx = 4; dx < W; dx += 26) rect(c, dx, 156, 12, 2, '#33333d');
}

// ---- THE YARD ---------------------------------------------------------------

function buildYard(bd, c, st) {
  const rng = st.rng;
  rect(c, 0, 0, W, H, '#101018'); // yard dark, everywhere first
  // sky + moon
  rect(c, 0, 0, W, 16, '#0a0a18');
  for (let dy = -3; dy <= 3; dy++) {
    const ww = Math.round(Math.sqrt(9 - dy * dy));
    rect(c, 42 - ww, 8 + dy, ww * 2, 1, '#e8e4c8');
  }
  rect(c, 40, 7, 2, 2, '#d0ccb0'); rect(c, 43, 10, 2, 1, '#d0ccb0');
  // distant yard office, lit late
  rect(c, 6, 6, 40, 10, '#14141e');
  rect(c, 10, 9, 4, 4, '#c8a04a'); rect(c, 18, 9, 4, 4, '#3a3020'); rect(c, 26, 9, 4, 4, '#c8a04a');
  rect(c, 34, 9, 4, 4, '#3a3020');
  rect(c, 20, 2, 3, 4, '#14141e');
  // background strip where the sister train rolls (drawn dynamic)
  rect(c, 0, 16, W, 10, '#0e0e18');
  // floodlight tower
  rect(c, 304, 10, 3, 124, '#2e2e38');
  rect(c, 296, 10, 11, 3, '#2e2e38');
  rect(c, 296, 13, 4, 3, '#ffe9a0');
  // the signal
  rect(c, 8, 100, 3, 40, '#2e2e38');
  rect(c, 5, 92, 9, 12, '#1c1c26');
  // our train
  drawSurface(c, SX, SY, SW, SH, 'train', rng, st.line);
  // rails + sleepers + gravel under the car
  rect(c, 0, 134, W, 2, '#585c66');
  rect(c, 0, 138, W, 1, '#40444e');
  for (let sx = 2; sx < W; sx += 14) rect(c, sx, 136, 8, 4, '#2a2a32');
  rect(c, 0, 142, W, 58, '#20202a');
  ctx_gravel(c, rng);
  // a second track in the foreground
  rect(c, 0, 158, W, 2, '#444852');
  rect(c, 0, 162, W, 1, '#343842');
  // electrical cabinet + barrels
  rect(c, 294, 108, 20, 26, '#2a4a34');
  rect(c, 296, 112, 16, 2, '#1d3625'); rect(c, 296, 118, 16, 2, '#1d3625');
  rect(c, 304, 126, 6, 4, '#ffe040');
  rect(c, 276, 146, 9, 12, '#4a3a2a'); rect(c, 286, 148, 9, 10, '#3a3a4a');
  rect(c, 276, 146, 9, 2, '#5c4a34'); rect(c, 286, 148, 9, 2, '#4a4a5c');

  const guard = makeGuard(irange(rng, 0, 1e9));
  st.actors = {
    guard, gx: W + 30, gdir: -1, gNext: 8 + rng() * 10,
    dtx: -80,
    sigRed: true, sigNext: 2.4,
  };

  st.tick = dt => {
    const a = st.actors;
    // distant train drifts through the yard
    a.dtx += dt * 9;
    if (a.dtx > W + 90) a.dtx = -180;
    // signal
    a.sigNext -= dt;
    if (a.sigNext <= 0) { a.sigRed = !a.sigRed; a.sigNext = 2.4; }
    // the guard makes his rounds, slow
    if (a.gNext > 0) a.gNext -= dt;
    else {
      a.gx += a.gdir * 11 * dt;
      if (a.gx < -30 || a.gx > W + 30) {
        a.gdir *= -1;
        a.gNext = 12 + st.rng() * 14;
      }
    }
  };

  st.drawDyn = ctx => {
    const a = st.actors, t = st.t;
    // sister train, dim, windows lit
    const dx = Math.round(a.dtx);
    for (let carN = 0; carN < 2; carN++) {
      const cx = dx + carN * 92;
      rect(ctx, cx, 17, 86, 8, '#14141e');
      for (let wx = 4; wx < 82; wx += 9) rect(ctx, cx + wx, 19, 5, 3, '#6a6248');
    }
    // signal lamps
    rect(ctx, 7, 94, 3, 3, a.sigRed ? '#ff3030' : '#341212');
    rect(ctx, 7, 99, 3, 3, a.sigRed ? '#123412' : '#40e050');
    // floodlight cone over the car, with a breath of flicker
    const flick = 0.07 + 0.015 * Math.sin(t * 3.1);
    ctx.fillStyle = '#ffe9a0';
    for (let step = 0; step < 6; step++) {
      ctx.globalAlpha = flick * (1 - step / 6);
      rect(ctx, 298 - step * 16, 16 + step * 8, 10 + step * 16, 9, '#ffe9a0');
    }
    ctx.globalAlpha = 1;
    // the guard on his rounds (behind our car he'd be invisible; he
    // walks the near track)
    if (a.gNext <= 0) {
      const moving = true;
      const cv = moving ? walkFrame(a.guard, t) : idleFrame(a.guard, t);
      drawSpriteFlip(ctx, cv, a.gx, 138, a.gdir === 1);
      // flashlight
      const fx = a.gdir === 1 ? a.gx + 16 : a.gx - 10;
      ctx.globalAlpha = 0.12;
      rect(ctx, fx, 152, 10 * a.gdir, 6, '#ffe9a0');
      rect(ctx, a.gdir === 1 ? fx + 10 : fx - 14, 154, 14 * a.gdir, 4, '#ffe9a0');
      ctx.globalAlpha = 1;
    }
  };
}

function ctx_gravel(c, rng) {
  c.fillStyle = '#2c2c36';
  for (let i = 0; i < 160; i++) c.fillRect(Math.floor(rng() * W), 142 + Math.floor(rng() * 20), 1, 1);
  c.fillStyle = '#181820';
  for (let i = 0; i < 120; i++) c.fillRect(Math.floor(rng() * W), 142 + Math.floor(rng() * 20), 1, 1);
}

// ---- THE GALLERY --------------------------------------------------------------

function buildGallery(bd, c, st) {
  const rng = st.rng;
  // ceiling + track lighting
  rect(c, 0, 0, W, 10, '#d9d5cc');
  rect(c, 20, 8, 280, 2, '#3a3a40');
  for (const lx of [70, 160, 250]) {
    rect(c, lx, 10, 6, 4, '#2c2c32');
    rect(c, lx + 1, 14, 4, 1, '#ffe9a0');
  }
  // walls
  rect(c, 0, 10, W, 122, '#eae7e0');
  rect(c, 0, 128, W, 2, '#d5d0c5');
  // the canvas (our surface)
  drawSurface(c, SX, SY, SW, SH, 'gallery', rng);
  // title card
  rect(c, 250, 120, 22, 8, '#f8f6f0'); frame(c, 250, 120, 22, 8, '#c9c4b8');
  rect(c, 252, 123, 14, 1, '#8a857a'); rect(c, 252, 125, 9, 1, '#b0aa9c');
  // window onto the city, right wall
  rect(c, 294, 22, 24, 100, '#0e1c30');
  frame(c, 293, 21, 26, 102, '#8a8272');
  rect(c, 305, 22, 2, 100, '#8a8272');
  rect(c, 294, 74, 24, 2, '#8a8272');
  // skyline in the window
  for (let bx = 0; bx < 3; bx++) {
    const bh = 20 + Math.floor(rng() * 26);
    rect(c, 295 + bx * 8, 120 - bh, 7, bh, '#131322');
  }
  st.cityLights = [];
  for (let i = 0; i < 14; i++) {
    st.cityLights.push({
      x: 296 + Math.floor(rng() * 20), y: 80 + Math.floor(rng() * 38),
      lit: rng() < 0.5, next: 3 + rng() * 10,
    });
  }
  // moon in the window
  rect(c, 310, 30, 4, 4, '#e8e4c8'); rect(c, 311, 29, 2, 6, '#e8e4c8');
  // wood floor (before the furniture that stands on it)
  rect(c, 0, 132, W, 68, '#7a5c40');
  for (let fy = 138; fy < 200; fy += 8) rect(c, 0, fy, W, 1, '#6a4e36');
  for (let fx = 20; fx < W; fx += 48) rect(c, fx, 132, 1, 68, '#6a4e36');
  // pedestal with a blue period sculpture
  rect(c, 8, 96, 14, 36, '#f2efe8'); frame(c, 8, 96, 14, 36, '#cdc8bc');
  rect(c, 11, 86, 8, 10, '#3a5c9c'); rect(c, 13, 82, 4, 5, '#4a6cac'); rect(c, 10, 90, 10, 3, '#2a4c8c');
  // wine + cheese table
  rect(c, 38, 146, 34, 3, '#f4f1ea');
  rect(c, 40, 149, 3, 12, '#c9c4b8'); rect(c, 67, 149, 3, 12, '#c9c4b8');
  rect(c, 44, 138, 3, 8, '#1d3625'); rect(c, 44, 136, 3, 2, '#2a4a34');
  rect(c, 51, 141, 2, 5, '#d8e8f0'); rect(c, 50, 140, 4, 1, '#d8e8f0');
  rect(c, 56, 141, 2, 5, '#d8e8f0'); rect(c, 55, 140, 4, 1, '#d8e8f0');
  rect(c, 61, 143, 7, 3, '#f0d060'); rect(c, 62, 142, 5, 1, '#f8e080');
  // bench, very modern
  rect(c, 130, 150, 44, 5, '#1a1a20');
  rect(c, 132, 155, 3, 8, '#8a8f98'); rect(c, 169, 155, 3, 8, '#8a8f98');
  // potted plant
  rect(c, 300, 146, 10, 10, '#8a4a2e');
  rect(c, 302, 138, 2, 8, '#2a5c30'); rect(c, 306, 136, 2, 10, '#2a5c30');
  rect(c, 299, 140, 3, 4, '#347038'); rect(c, 308, 141, 3, 4, '#347038');

  const mgr = makeManager(irange(rng, 0, 1e9));
  st.actors = { mgr, mx: 200, mdir: -1, pause: 2, hmm: 0, clinkNext: 12 + rng() * 10 };

  st.tick = dt => {
    const a = st.actors;
    if (a.pause > 0) {
      a.pause -= dt;
      if (a.pause <= 0 && st.rng() < 0.4) { a.hmm = 2; }
    } else {
      a.mx += a.mdir * 9 * dt;
      if (a.mx < 60 || a.mx > 250) { a.mdir *= -1; a.pause = 2 + st.rng() * 3; }
      else if (st.rng() < dt / 6) a.pause = 2 + st.rng() * 3;
    }
    if (a.hmm > 0) a.hmm -= dt;
    a.clinkNext -= dt;
    if (a.clinkNext <= 0) { sfxClink(); a.clinkNext = 14 + st.rng() * 14; }
  };

  st.drawDyn = ctx => {
    const a = st.actors, t = st.t;
    // window city lights
    for (const l of st.cityLights) {
      l.next -= 0; // toggled in draw for simplicity: use time hash
      rect(ctx, l.x, l.y, 1, 1, (Math.sin(t * 0.4 + l.x * 3 + l.y) > -0.4) === l.lit ? '#c8a04a' : '#2a2a3a');
    }
    // spotlight cones onto the canvas, shimmering ever so slightly
    ctx.fillStyle = '#fff6d8';
    for (const lx of [70, 160, 250]) {
      const shim = 0.07 + 0.012 * Math.sin(t * 1.4 + lx);
      for (let step = 0; step < 5; step++) {
        ctx.globalAlpha = shim * (1 - step / 5);
        rect(ctx, lx + 2 - (3 + step * 4), 15 + step * 5, 6 + step * 8, 5, '#fff6d8');
      }
    }
    ctx.globalAlpha = 1;
    // the manager drifts, considers, hmms
    const moving = a.pause <= 0;
    const cv = moving ? walkFrame(a.mgr, t) : idleFrame(a.mgr, t);
    drawSpriteFlip(ctx, cv, a.mx, 132, a.mdir === 1);
    // wine glass in hand
    const gx = a.mdir === 1 ? a.mx + 14 : a.mx - 1;
    rect(ctx, gx, 146, 2, 2, '#e8d8f0'); rect(ctx, gx, 148, 1, 2, '#d8e8f0');
    if (a.hmm > 0) {
      ctx.globalAlpha = Math.min(1, a.hmm);
      text(ctx, 'HMM.', Math.round(a.mx) - 2, 120, '#8a857a');
      ctx.globalAlpha = 1;
    }
  };
}
