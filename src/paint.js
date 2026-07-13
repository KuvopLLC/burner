// paint.js — the arcade heart: the paint scene and the result scene.
// No clock, no meters — the pressure is what comes down the street.
// Trouble (cops, yard dogs) arrives in waves that come faster the longer
// you stay at the wall and the deeper into the run you are. Finish every
// color region and the piece goes up; get caught three times and the
// run is over.

import { W, H, text, centerText, scenter, stext, rect, frame, panel, meter, makeCanvas, drawSurface, makePolaroid } from './gfx.js';
import { COLORS, PED_LINES } from './data.js';
import { makeRng, pick, irange } from './rng.js';
import { makeKid, makeCop, makeDog, makePedestrian, renderSketch, renderPiece, pieceShade } from './gen.js';
import { makeScenery, drawSpriteFlip, idleFrame, walkFrame } from './scenery.js';
import { addPiece, level } from './world.js';
import { sfxSpray, sfxSiren, sfxWhistle, sfxBust, sfxPop, sfxTick, sfxBark, sfxRattle, sfxTwinkle, playBeat, startAmbience } from './audio.js';

// Piece placement on screen: surface centered in the wider frame
const SURF_X = 60, PX = SURF_X + 12, PY = 34;

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const REGION_NAMES = { 1: 'FILL A', 2: 'FILL B', 3: 'LINES', 4: 'SHADOW', 5: 'CLOUD' };

export const paintScene = {
  enter(G) {
    const run = G.run;
    const piece = run.piece, spot = run.spot;
    const lvl = level(run);
    const rng = makeRng(hashStr(run.tag + spot.id) ^ (lvl + 1));
    const paintStyle = spot.kind === 'gallery' ? 'mellow'
      : ['boombap', 'funk', 'electro'][(hashStr(spot.id) + lvl) % 3];
    playBeat(hashStr('paint' + spot.id) + lvl * 131, paintStyle);
    startAmbience(spot.kind === 'wall' ? 'street' : spot.kind);

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

    // The bag: the 5 colors the sketch needs + 1 decoy, shuffled
    const needed = [1, 2, 3, 4, 5].map(r => piece.palette[r]);
    const neededIds = new Set(needed.map(c => c.id));
    const decoys = COLORS.filter(c => !neededIds.has(c.id));
    const bag = [...needed, pick(rng, decoys)]
      .filter((c, i, a) => a.indexOf(c) === i);
    while (bag.length < 6) bag.push(pick(rng, decoys));
    for (let i = bag.length - 1; i > 0; i--) { // shuffle
      const j = Math.floor(rng() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }

    const ptag = run.partner.tag;
    // one key-press = one spray burst
    let burstR = 7;
    if (ptag === 'SABLE' || ptag === 'CRISPO 149') burstR++;
    if (ptag === 'TEKO 5') burstR += 2;

    // paint-by-numbers ghost: the finished piece, faint, on the wall
    const ghost = renderPiece(piece);

    this.s = {
      rng, piece, spot, guide, ghost, masks, bag, lvl,
      scenery: makeScenery(spot.kind, hashStr(spot.id) ^ 0x5EED, spot.line),
      covered: new Uint8Array(piece.w * piece.h),
      coveredCount: 0,
      totalRegion: Object.values(piece.counts).reduce((a, b) => a + b, 0),
      regCov: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      // a region with no pixels is born finished (belt + suspenders)
      regDone: Object.fromEntries([1, 2, 3, 4, 5].map(r => [r, piece.counts[r] === 0])),
      regDoneFrac: ptag === 'LADY VEX' ? 0.93 : 0.97,
      paintCv: makeCanvas(piece.w, piece.h),
      selected: 0,
      burstR,
      elapsed: 0,
      nextTrouble: spot.danger > 0 ? 6 + rng() * 4 : Infinity,
      warned: false,
      cop: null,          // patrolling: {x, dir, facing, phase, pauseT, turnX, passes, exposeT, spotted}
      dog: null,          // {x, dir, bit}
      fireHeld: false, autoT: 0,
      pal: {
        frames: makeKid(hashStr(run.partner.tag), run.partner.hue),
        x: 320, dir: -1, hidden: false, burstT: 2.5, target: null, scan: 0,
        rate: ptag === 'CRISPO 149' ? 1.3 : 1.9,
        radius: ptag === 'TEKO 5' ? 7 : 5,
      },
      ped: null,
      pedTimer: 5 + rng() * 6,
      msg: '[X] SPRAY · ARROWS SWITCH CANS · [SPACE] HIDE',
      msgT: 5,
      sprayT: 0,
      fx: [],
      regFlash: null,
      busted: false, bustedT: 0, bustedBy: null,
      done: false, doneT: 0,
      bailArm: 0,         // double-tap ENTER to dip out early
      readyTold: false,
      twk: [], twkNext: 0.6, // sparkle particles on the fresh paint
      kid: makeKid(hashStr(run.tag), hashStr(run.tag) % 360),
      kidX: 150, kidVel: 0,
      copSprite: makeCop(hashStr(spot.id)),
      dogSprite: makeDog(hashStr(spot.id) ^ 77),
      hiding: false,
      pulse: 0,
    };
  },

  // trouble arrives faster at dangerous spots, on later nights, and the
  // longer you've been standing at this wall
  troubleInterval(s, G) {
    const ptag = G.run.partner.tag;
    let base = 15 - s.lvl * 0.9 - s.spot.danger * 1.3;
    if (ptag === 'MERC ONE' && s.spot.kind === 'train') base *= 1.4;
    base *= Math.max(0.5, 1 - s.elapsed / 120);
    return Math.max(4, base) * (0.8 + s.rng() * 0.4);
  },

  update(G, dt) {
    const s = this.s;
    s.scenery.update(dt);
    if (s.busted) {
      s.bustedT += dt;
      if (s.bustedT > 2.5) {
        sfxSpray(false);
        G.run.strikes++;
        G.go(G.run.strikes >= 3 ? 'gameover' : 'intermission');
      }
      return;
    }
    if (s.done) {
      s.doneT += dt;
      if (s.doneT > 1.4) {
        sfxSpray(false);
        G.mission = { paintCv: s.paintCv[0] };
        G.go('result');
      }
      return;
    }
    s.pulse += dt * 6;
    s.elapsed += dt;
    s.msgT -= dt;
    if (s.bailArm > 0) s.bailArm -= dt;

    // burst hiss + effects
    if (s.sprayT > 0) { s.sprayT -= dt; sfxSpray(true); }
    else sfxSpray(false);
    for (const f of s.fx) f.t += dt;
    s.fx = s.fx.filter(f => f.t < 0.25);
    if (s.regFlash) { s.regFlash.t -= dt; if (s.regFlash.t <= 0) s.regFlash = null; }

    // hold to spray: X or the mouse button autofires
    const overWall = G.mouse.x >= PX - 8 && G.mouse.x < PX + s.piece.w + 8 &&
                     G.mouse.y >= PY - 8 && G.mouse.y < PY + s.piece.h + 8;
    if ((s.fireHeld || (G.mouse.down && overWall)) && !s.hiding) {
      s.autoT -= dt;
      if (s.autoT <= 0) {
        burst(G, s, G.mouse.x, G.mouse.y);
        s.autoT = 0.15;
      }
    } else {
      s.autoT = 0;
    }

    // your partner works the wall with you
    updatePal(G, s, dt);

    // the kid drifts toward the cursor — feet, not teleports
    const targetX = Math.max(SURF_X + 2, Math.min(SURF_X + 244, G.mouse.x - 10));
    s.kidVel = (targetX - s.kidX) * Math.min(1, dt * 8);
    s.kidX += s.kidVel;

    // fresh paint catches the light
    for (const tw of s.twk) tw.t += dt;
    s.twk = s.twk.filter(tw => tw.t < 0.7);
    s.twkNext -= dt;
    if (s.twkNext <= 0 && s.coveredCount > 300) {
      s.twkNext = 0.5 + s.rng() * 0.6;
      for (let tries = 0; tries < 20; tries++) {
        const i = Math.floor(s.rng() * s.piece.w * s.piece.h);
        if (s.covered[i]) {
          s.twk.push({ x: PX + (i % s.piece.w), y: PY + Math.floor(i / s.piece.w), t: 0 });
          break;
        }
      }
    }

    // ---- trouble scheduler ----
    if (!s.cop && !s.dog && s.nextTrouble !== Infinity) {
      s.nextTrouble -= dt;
      if (!s.warned && s.nextTrouble < 1.6 && G.run.partner.tag === 'KWIK 12') {
        s.warned = true;
        sfxWhistle();
        say(s, 'KWIK WHISTLES — SOMETHING\'S COMING!');
      }
      if (s.nextTrouble <= 0) {
        s.warned = false;
        const dogChance = Math.min(0.65, 0.12 + s.lvl * 0.07 + s.elapsed / 160 +
          (s.spot.kind === 'train' ? 0.1 : 0));
        if (s.rng() < dogChance) {
          const dir = s.rng() < 0.5 ? 1 : -1;
          s.dog = { x: dir === 1 ? -20 : W + 20, dir, bit: false };
          sfxBark();
          say(s, 'DOG!! [SPACE] GET UP ON THE DUMPSTER!');
        } else {
          s.cop = {
            x: W + 14, dir: -1, facing: -1, phase: 'walk',
            pauseT: 0, turnX: 120 + s.rng() * 120,
            passes: s.lvl >= 3 ? 2 : 1,
            exposeT: 0, spotted: false,
          };
          sfxSiren();
          say(s, '5-0 ON THE BLOCK — STAY OUT OF HIS SIGHT');
        }
      }
    }

    // ---- cop: he patrols; stay out of the flashlight ----
    if (s.cop) {
      const c = s.cop;
      const speed = 26 + s.lvl * 2;
      if (c.phase === 'walk') {
        c.x += c.dir * speed * dt;
        c.facing = c.dir;
        if (c.dir === -1 && c.x <= c.turnX && c.passes > 0) {
          c.phase = 'scan';
          c.pauseT = 1.3 + s.rng() * 0.9;
          c.passes--;
          c.turnX = Math.max(70, c.turnX - (80 + s.rng() * 60));
        }
        if (c.x < -34) { s.cop = null; s.nextTrouble = this.troubleInterval(s, G); }
        if (c.x > W + 40) { s.cop = null; s.nextTrouble = this.troubleInterval(s, G); }
      } else { // scan: he stops and looks around — the danger window
        const kidX = s.kidX + 10;
        c.facing = kidX > c.x ? 1 : -1;
        c.pauseT -= dt;
        if (c.pauseT <= 0) c.phase = 'walk';
      }
      // does he see you?
      if (s.cop) {
        const kidX = s.kidX + 10;
        const dx = kidX - c.x;
        const inCone = !s.hiding && ((dx * c.facing > 0 && Math.abs(dx) < 80) || Math.abs(dx) < 24);
        if (inCone) {
          if (!c.spotted) { c.spotted = true; say(s, 'HE SEES YOU!! [SPACE] HIDE!'); }
          c.exposeT += dt;
          if (c.exposeT > 1.1) return bust(G, this, 'cop');
        } else {
          c.spotted = false;
          c.exposeT = Math.max(0, c.exposeT - dt * 0.9);
        }
      }
    }

    // ---- yard dog: fast, no mercy, hop the dumpster ----
    if (s.dog) {
      const d = s.dog;
      const speed = 55 + s.lvl * 4 + s.spot.danger * 3;
      d.x += d.dir * speed * dt;
      const kidX = Math.max(SURF_X + 2, Math.min(SURF_X + 244, G.mouse.x - 10)) + 10;
      if (!d.bit && !s.hiding && Math.abs(d.x + 12 - kidX) < 13) {
        d.bit = true;
        return bust(G, this, 'dog');
      }
      if (Math.abs(d.x - W / 2) < 4) sfxBark();
      if (d.x < -30 || d.x > W + 30) { s.dog = null; s.nextTrouble = this.troubleInterval(s, G); }
    }

    // ---- pedestrians: just the neighborhood, watching ----
    s.pedTimer -= dt;
    if (s.pedTimer <= 0 && !s.ped && s.spot.kind !== 'gallery') {
      const dir = s.rng() < 0.5 ? 1 : -1;
      s.ped = {
        x: dir === 1 ? -14 : W + 14, dir,
        line: pick(s.rng, PED_LINES), spoke: false,
        sprite: makePedestrian(irange(s.rng, 0, 1e9)),
      };
      s.pedTimer = 9 + s.rng() * 9;
    }
    if (s.ped) {
      const p = s.ped;
      p.x += p.dir * 26 * dt;
      if (!p.spoke && Math.abs(p.x - W / 2) < 30) {
        p.spoke = true;
        if (s.msgT <= 0) say(s, `"${p.line}"`);
      }
      if (p.x < -16 || p.x > W + 16) s.ped = null;
    }
  },

  key(G, e) {
    const s = this.s;
    if (s.busted || s.done) return;
    if (e.type === 'down') {
      if (e.key === ' ') { if (!s.hiding) G.run.hides++; s.hiding = true; sfxSpray(false); s.sprayT = 0; }
      if (e.key === 'x' || e.key === 'X') { s.fireHeld = true; burst(G, s, G.mouse.x, G.mouse.y); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { s.selected = (s.selected + 1) % s.bag.length; sfxRattle(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { s.selected = (s.selected + s.bag.length - 1) % s.bag.length; sfxRattle(); }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= s.bag.length && n - 1 !== s.selected) { s.selected = n - 1; sfxRattle(); }
      if (e.key === 'Enter') {
        const frac = s.coveredCount / s.totalRegion;
        if (frac >= 0.6) {
          // it reads — call it done and get out
          s.done = true;
          s.doneT = 0;
          sfxPop();
        } else if (s.bailArm > 0) {
          // dipping out with nothing — no piece, no strike
          sfxSpray(false);
          G.go('intermission');
        } else {
          s.bailArm = 2;
          say(s, 'NOT DONE — [ENTER] AGAIN TO DIP');
        }
      }
    } else if (e.key === ' ') {
      s.hiding = false;
    } else if (e.key === 'x' || e.key === 'X') {
      s.fireHeld = false;
    }
  },

  click(G, x, y) {
    const s = this.s;
    if (s.busted || s.done) return;
    // can selection by clicking the bag; anywhere on the piece = spray
    const bagX = (W - (s.bag.length * 40 + 12)) / 2;
    const i = Math.floor((x - bagX - 6) / 40);
    if (y >= 180 && y <= 214 && i >= 0 && i < s.bag.length) {
      if (i !== s.selected) { s.selected = i; sfxRattle(); }
      return;
    }
    burst(G, s, x, y);
  },

  draw(G, ctx) {
    const s = this.s, run = G.run;
    // the whole living scene: sky, stars, street or yard or gallery
    s.scenery.draw(ctx);

    // paint-by-numbers: the finished piece ghosts on the wall, and your
    // real paint covers it at full strength
    ctx.globalAlpha = 0.30;
    ctx.drawImage(s.ghost, PX, PY);
    ctx.globalAlpha = 1;
    ctx.drawImage(s.guide, PX, PY);
    ctx.drawImage(s.paintCv[0], PX, PY);

    // pulse the region the selected can belongs to
    const sel = s.bag[s.selected];
    const rid = Object.keys(s.piece.palette).find(r => s.piece.palette[r].id === sel.id);
    if (rid && !s.regDone[rid]) {
      ctx.globalAlpha = 0.16 + 0.13 * Math.sin(s.pulse);
      ctx.drawImage(s.masks[rid], PX, PY);
      ctx.globalAlpha = 1;
    }

    // a finished region flashes white for a beat
    if (s.regFlash) {
      ctx.globalAlpha = Math.min(0.5, s.regFlash.t);
      ctx.drawImage(s.masks[s.regFlash.rid], PX, PY);
      ctx.globalAlpha = 1;
    }

    // burst rings
    for (const f of s.fx) {
      const rr = s.burstR * (0.4 + f.t * 3);
      ctx.globalAlpha = Math.max(0, 0.6 - f.t * 2.5);
      ctx.fillStyle = '#fff';
      for (let a = 0; a < 16; a++) {
        const fx = Math.round(f.x + Math.cos(a * 0.3927) * rr);
        const fy = Math.round(f.y + Math.sin(a * 0.3927) * rr);
        if (fx >= SURF_X && fx < SURF_X + 264 && fy >= 26 && fy < 132) ctx.fillRect(fx, fy, 1, 1);
      }
      ctx.globalAlpha = 1;
    }

    // aiming ring: where the next burst lands, and which can this spot wants
    const m = G.mouse;
    if (!s.hiding && !s.busted && !s.done &&
        m.x >= PX - 6 && m.x < PX + s.piece.w + 6 && m.y >= PY - 6 && m.y < PY + s.piece.h + 6) {
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#fff';
      for (let a = 0; a < 24; a++) {
        const ax = Math.round(m.x + Math.cos(a * 0.2618) * s.burstR);
        const ay = Math.round(m.y + Math.sin(a * 0.2618) * s.burstR);
        if (ax >= SURF_X && ax < SURF_X + 264 && ay >= 26 && ay < 132) ctx.fillRect(ax, ay, 1, 1);
      }
      ctx.globalAlpha = 1;
      // hover hint: the can number this region needs
      const hx = Math.round(m.x - PX), hy = Math.round(m.y - PY);
      if (hx >= 0 && hx < s.piece.w && hy >= 0 && hy < s.piece.h) {
        const hrid = s.piece.regions[hy * s.piece.w + hx];
        if (hrid && !s.regDone[hrid]) {
          const wantId = s.piece.palette[hrid].id;
          const bagIdx = s.bag.findIndex(c => c.id === wantId);
          if (bagIdx >= 0) {
            const tagX = Math.min(SURF_X + 264, m.x + s.burstR + 3);
            const right = bagIdx === s.selected;
            rect(ctx, tagX, m.y - 5, 17, 11, '#101018');
            frame(ctx, tagX, m.y - 5, 17, 11, right ? '#40cc50' : '#ffe040');
            rect(ctx, tagX + 2, m.y - 3, 6, 7, s.piece.palette[hrid].hex);
            text(ctx, String(bagIdx + 1), tagX + 10, m.y - 3, right ? '#40cc50' : '#ffe040');
          }
        }
      }
    }

    // sparkle: fresh paint catching the streetlight
    for (const tw of s.twk) {
      if (tw.t < 0) continue; // staggered celebration sparkles
      const ph = tw.t / 0.7;
      const r = ph < 0.5 ? 1 + ph * 4 : 3 - (ph - 0.5) * 4;
      ctx.globalAlpha = 0.9 - ph * 0.8;
      ctx.fillStyle = '#fff';
      ctx.fillRect(tw.x, tw.y, 1, 1);
      ctx.fillRect(tw.x - r, tw.y, r, 1); ctx.fillRect(tw.x + 1, tw.y, r, 1);
      ctx.fillRect(tw.x, tw.y - r, 1, r); ctx.fillRect(tw.x, tw.y + 1, 1, r);
      ctx.globalAlpha = 1;
    }

    // whoever's hiding draws BEHIND cover
    if (s.hiding) drawSpriteFlip(ctx, s.kid.idle[0], 30, 100, false);
    if (s.pal.hidden) drawSpriteFlip(ctx, idleFrame(s.pal.frames, s.pulse / 6, 1.1), 46, 102, false);

    // cover: a dumpster on the street and in the yard, a divider screen
    // at the gallery
    if (s.spot.kind === 'gallery') {
      rect(ctx, 24, 106, 30, 32, '#f2efe8');
      frame(ctx, 24, 106, 30, 32, '#c9c4b8');
      rect(ctx, 38, 108, 1, 28, '#ddd8cc');
    } else {
      rect(ctx, 24, 118, 28, 20, '#2a4a34');
      rect(ctx, 24, 116, 28, 3, '#3a5f44');
      rect(ctx, 24, 128, 28, 1, '#1d3625');
      rect(ctx, 27, 121, 4, 3, '#1d3625');
      rect(ctx, 45, 121, 4, 3, '#1d3625');
    }

    if (s.hiding) {
      text(ctx, '!', 38, 94, '#ffe040');
    } else if (!s.busted) {
      const kx = Math.round(s.kidX);
      const moving = Math.abs(s.kidVel) > 0.35;
      const cv = moving ? walkFrame(s.kid, s.pulse / 3) : idleFrame(s.kid, s.pulse / 6);
      const bob = moving ? 0 : (Math.sin(s.pulse * 0.4) > 0.5 ? 1 : 0);
      drawSpriteFlip(ctx, cv, kx, 112 + bob, moving && s.kidVel < 0);
      rect(ctx, kx + (G.mouse.x > kx + 10 ? 18 : -1), 132 + bob, 2, 5, sel.hex); // can in hand
    }

    // your partner, working
    if (!s.pal.hidden) {
      const pal = s.pal;
      const moving = pal.target && Math.abs((PX + pal.target.x - 10) - pal.x) > 5;
      const pcv = moving ? walkFrame(pal.frames, s.pulse / 3.2) : idleFrame(pal.frames, s.pulse / 6, 0.7);
      drawSpriteFlip(ctx, pcv, Math.round(pal.x), 112, pal.dir === -1);
      if (pal.target) {
        rect(ctx, Math.round(pal.x) + (pal.dir === 1 ? 18 : -1), 132, 2, 5,
          s.piece.palette[pal.target.rid].hex); // their can
      }
    }

    if (s.ped) {
      drawSpriteFlip(ctx, walkFrame(s.ped.sprite, s.pulse / 4), Math.round(s.ped.x), 132, s.ped.dir === -1);
    }
    if (s.cop) {
      const c = s.cop;
      const cv = c.phase === 'walk' ? walkFrame(s.copSprite, s.pulse / 3.5) : idleFrame(s.copSprite, s.pulse / 6);
      drawSpriteFlip(ctx, cv, Math.round(c.x), 132, c.facing === 1);
      // the flashlight: where he's looking is where you can't be
      const fx = c.facing === 1 ? c.x + 20 : c.x - 4;
      ctx.fillStyle = '#ffe9a0';
      for (let step = 0; step < 4; step++) {
        ctx.globalAlpha = (c.phase === 'scan' ? 0.16 : 0.10) * (1 - step / 4);
        const bw = 18 + step * 18;
        rect(ctx, c.facing === 1 ? fx + step * 18 : fx - step * 18 - 18, 138 + step * 2, bw, 16 - step * 2, '#ffe9a0');
      }
      ctx.globalAlpha = 1;
      if (c.exposeT > 0 && Math.sin(s.pulse * 3) > 0) {
        stext(ctx, '!', Math.round(c.x) + 8, 118, '#ff3030');
      }
    }
    if (s.dog) {
      const d = s.dog;
      drawSpriteFlip(ctx, s.dogSprite.walk[Math.floor(s.pulse * 2.2) % 2], Math.round(d.x), 150, d.dir === 1);
      const flash = Math.sin(s.pulse * 3) > 0;
      stext(ctx, 'GRRR', Math.round(d.x), 142, flash ? '#ff3030' : '#ffe040');
    }

    // HUD — just the night, the piece, and your strikes, on dark chips
    // so they read against any scene
    const frac = s.coveredCount / s.totalRegion;
    ctx.globalAlpha = 0.62;
    rect(ctx, 4, 2, 62, 20, '#0b0b12');
    rect(ctx, 118, 2, 64, 20, '#0b0b12');
    ctx.globalAlpha = 1;
    text(ctx, `NIGHT ${s.lvl + 1}`, 8, 5, '#fff');
    meter(ctx, 122, 6, 56, 7, frac, frac >= 0.6 ? '#40cc50' : '#cccc40');
    rect(ctx, 122 + Math.round(56 * 0.6), 5, 1, 9, '#c8c8d0'); // "it reads" mark
    text(ctx, `PIECE ${Math.floor(frac * 100)}%`, 124, 14, '#aaa');
    for (let i = 0; i < 3; i++) {
      text(ctx, 'X', 8 + i * 9, 14, i < run.strikes ? '#ff3030' : '#3f3f50');
    }
    drawCrewCorner(G, ctx);

    // bag of cans
    const bagW = s.bag.length * 40 + 12;
    const bagX = (W - bagW) / 2;
    panel(ctx, bagX, 178, bagW, 36, '#101018', '#3a3a52');
    for (let i = 0; i < s.bag.length; i++) {
      const cx = bagX + 6 + i * 40;
      const isSel = i === s.selected;
      if (isSel) frame(ctx, cx - 2, 181, 36, 30, '#fff');
      rect(ctx, cx + 1, 185, 12, 20, '#15130f');      // silhouette
      rect(ctx, cx + 2, 186, 10, 18, s.bag[i].hex);   // body
      ctx.globalAlpha = 0.3;
      rect(ctx, cx + 3, 186, 2, 18, '#fff');          // sheen
      ctx.globalAlpha = 1;
      rect(ctx, cx + 2, 193, 10, 5, '#ece7d8');       // label band
      rect(ctx, cx + 4, 195, 6, 1, s.bag[i].hex);
      rect(ctx, cx + 4, 182, 6, 3, '#8a8f98');        // cap
      rect(ctx, cx + 5, 181, 4, 1, '#aab0ba');
      text(ctx, String(i + 1), cx + 17, 186, isSel ? '#fff' : '#777');
    }

    if (s.msgT > 0) scenter(ctx, s.msg, 156, '#ffe040');

    if (s.done) {
      scenter(ctx, s.doneAll ? 'BURNED IT!' : 'IT READS — YOU\'RE UP!', 80, '#40e050', 2);
    }

    if (s.busted) {
      rect(ctx, 0, 70, W, 50, '#600');
      centerText(ctx, s.bustedBy === 'dog' ? 'DOG GOT YOU!' : 'BUSTED!', 78, '#fff', 2);
      centerText(ctx, `STRIKE ${run.strikes + 1} OF 3 — PIECE LOST`, 104, '#fcc');
    }
  },
};

function say(s, msg) { s.msg = msg; s.msgT = 3.5; }

// Shared spray core: paint colorId pixels within r of (mx,my). Paint
// ONLY lands on pixels whose region wants that color — it is impossible
// to paint outside the designated areas.
function applyBurst(s, mx, my, colorId, r) {
  const px = Math.round(mx - PX), py = Math.round(my - PY);
  const w = s.piece.w, h = s.piece.h;
  const ctx = s.paintCv[1];
  let hit = 0, doneRid = 0;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const x = px + dx, y = py + dy;
      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      const i = y * w + x;
      const rid = s.piece.regions[i];
      if (!rid || s.piece.palette[rid].id !== colorId) continue;
      if (s.covered[i]) continue;
      ctx.fillStyle = pieceShade(s.piece, rid, x, y);
      ctx.fillRect(x, y, 1, 1);
      s.covered[i] = 1;
      s.coveredCount++;
      s.regCov[rid]++;
      if (!s.regDone[rid] && s.regCov[rid] >= s.piece.counts[rid] * s.regDoneFrac) {
        s.regDone[rid] = true;
        doneRid = rid;
      }
      hit++;
    }
  }
  return { hit, doneRid };
}

function afterBurst(s, hit, doneRid, mx, my) {
  if (hit <= 0) return;
  s.sprayT = 0.14;
  s.fx.push({ x: mx, y: my, t: 0 });
  if (doneRid) {
    sfxPop();
    sfxTwinkle();
    s.regFlash = { rid: doneRid, t: 0.5 };
    stampShines(s, doneRid);
    say(s, `${REGION_NAMES[doneRid]} DONE!`);
  }
  if ([1, 2, 3, 4, 5].every(rd => s.regDone[rd])) {
    s.done = true;
    s.doneAll = true;
    s.doneT = 0;
    sfxPop();
    celebrate(s);
  } else if (!s.readyTold && s.coveredCount / s.totalRegion >= 0.6) {
    s.readyTold = true;
    say(s, 'IT READS — [ENTER] CALLS IT DONE');
  }
}

// The player's burst: whatever can is in hand.
function burst(G, s, mx, my) {
  if (s.hiding || s.done || s.busted) return;
  const r = s.burstR;
  const px = mx - PX, py = my - PY;
  if (px < -r || px >= s.piece.w + r || py < -r || py >= s.piece.h + r) return;
  const { hit, doneRid } = applyBurst(s, mx, my, s.bag[s.selected].id, r);
  if (hit > 0) {
    G.run.bursts++;
    afterBurst(s, hit, doneRid, mx, my);
  } else {
    if (s.msgT <= 0) say(s, 'NOT HERE — CHECK THE SKETCH FOR THIS CAN');
    sfxTick();
  }
}

// Your partner: finds an unfinished region, walks to it, and lays paint
// with the RIGHT can — they came up doing this. They dive for cover
// when trouble's out.
function updatePal(G, s, dt) {
  const pal = s.pal;
  const trouble = s.dog || s.cop;
  pal.hidden = !!trouble;
  if (pal.hidden) {
    pal.dir = pal.x > 62 ? -1 : 1;
    pal.x += (56 - pal.x) * Math.min(1, dt * 4);
    pal.target = null;
    return;
  }
  if (s.done || s.busted) return;
  // pick something to paint
  if (!pal.target) {
    const regs = [1, 2, 3, 4, 5].filter(r => !s.regDone[r]);
    if (!regs.length) return;
    const reg = regs[Math.floor(s.rng() * regs.length)];
    const total = s.piece.w * s.piece.h;
    let i = pal.scan;
    for (let scanned = 0; scanned < total; scanned++, i = (i + 13) % total) {
      if (s.piece.regions[i] === reg && !s.covered[i]) {
        pal.target = { x: i % s.piece.w, y: Math.floor(i / s.piece.w), rid: reg };
        pal.scan = (i + 13) % total;
        break;
      }
    }
    if (!pal.target) return;
  }
  // walk to it
  const tx = PX + pal.target.x - 10;
  const dx = tx - pal.x;
  if (Math.abs(dx) > 5) {
    pal.dir = dx > 0 ? 1 : -1;
    pal.x += Math.max(-46 * dt, Math.min(46 * dt, dx * dt * 4));
  } else {
    pal.burstT -= dt;
    if (pal.burstT <= 0) {
      pal.burstT = pal.rate;
      const colorId = s.piece.palette[pal.target.rid].id;
      const { hit, doneRid } = applyBurst(s, PX + pal.target.x, PY + pal.target.y, colorId, pal.radius);
      afterBurst(s, hit, doneRid, PX + pal.target.x, PY + pal.target.y);
      pal.target = null;
    }
  }
}

// The classic graffiti shine: white gleam streaks stamped into a
// finished region, like the pieces in Subway Art.
function stampShines(s, rid) {
  const ctx = s.paintCv[1], w = s.piece.w, h = s.piece.h;
  ctx.fillStyle = '#ffffff';
  let placed = 0;
  for (let tries = 0; tries < 120 && placed < 2; tries++) {
    const i = Math.floor(s.rng() * w * h);
    if (s.piece.regions[i] !== rid || !s.covered[i]) continue;
    const x0 = i % w, y0 = Math.floor(i / w);
    const len = 4 + Math.floor(s.rng() * 4);
    let ok = true;
    for (let k = 0; k < len; k++) {
      const x = x0 + k, y = y0 - k;
      if (x >= w || y < 0 || s.piece.regions[y * w + x] !== rid) { ok = false; break; }
    }
    if (!ok) continue;
    for (let k = 0; k < len; k++) {
      ctx.fillRect(x0 + k, y0 - k, 1, 1);
      if (k < len - 1) ctx.fillRect(x0 + k + 1, y0 - k, 1, 1);
    }
    // flare at the top end
    const fx = x0 + len - 1, fy = y0 - len + 1;
    ctx.fillRect(fx - 1, fy, 3, 1);
    ctx.fillRect(fx, fy - 1, 1, 3);
    placed++;
  }
}

// all five regions down: rain sparkles on the whole piece
function celebrate(s) {
  for (let n = 0; n < 26; n++) {
    for (let tries = 0; tries < 15; tries++) {
      const i = Math.floor(s.rng() * s.piece.w * s.piece.h);
      if (s.covered[i]) {
        s.twk.push({
          x: PX + (i % s.piece.w), y: PY + Math.floor(i / s.piece.w),
          t: -s.rng() * 0.9, // staggered
        });
        break;
      }
    }
  }
}

function bust(G, scene, by) {
  const s = scene.s;
  s.busted = true;
  s.bustedT = 0;
  s.bustedBy = by;
  sfxSpray(false);
  sfxBust();
}

export const resultScene = {
  enter(G) {
    const run = G.run;
    // compose the finished wall for the polaroid
    const [comp, cc] = makeCanvas(264, 106);
    drawSurface(cc, 0, 0, 264, 106, run.spot.kind, makeRng(7), run.spot.line);
    cc.drawImage(G.mission.paintCv, PX - 28, PY - 26);
    const polaroid = makePolaroid(comp, 0, 0, 264, 106);
    const sketch = renderSketch(run.piece);
    addPiece(run, {
      spotId: run.spot.id,
      sketch, polaroid, partnerTag: run.partner.tag,
    });
    this.s = { comp, polaroid, t: 0 };
    sfxPop();
  },

  update(G, dt) { this.s.t += dt; },

  key(G, e) {
    if (e.type === 'down' && e.key === 'Enter' && this.s.t > 1) {
      G.bookReturn = 'intermission';
      G.go('book');
    }
  },

  draw(G, ctx) {
    const s = this.s, run = G.run;
    rect(ctx, 0, 0, W, H, '#0c0c1e');
    ctx.drawImage(s.comp, 60, 20);
    // polaroid drops in
    const py = Math.min(120, -60 + s.t * 260);
    ctx.drawImage(s.polaroid, 300, py);

    scenter(ctx, 'UP!', 148, '#40e050', 2);
    if (s.t > 1 && Math.sin(s.t * 4) > -0.3) scenter(ctx, '[ENTER] THE BOOK', 186, '#ffe040');
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
