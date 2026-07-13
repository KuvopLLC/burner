// world.js — run state: the writer, gear, live pieces, the compounding
// score engine, day advancement, strikes, high scores.

import { SPOTS } from './data.js';
import { makeRng } from './rng.js';

export function newRun(tag, stats, seed) {
  return {
    tag, stats, seed,
    rng: makeRng(seed ^ 0xBEEF),
    day: 1,
    score: 0,
    strikes: 0,
    piecesDone: 0,
    gear: { paint: 0, kicks: 0, fit: 0 },
    pieces: [],       // book entries
    partner: null,    // current mission partner
    piece: null,      // current mission piece
    spot: null,       // current mission spot
    news: [],         // ticker lines from the last day advance
  };
}

export function pointsPerDay(run, entry) {
  const spot = SPOTS.find(s => s.id === entry.spotId);
  const repMult = 1 + 0.15 * run.stats.rep;
  const fitMult = 1 + 0.15 * run.gear.fit;
  const trainBonus = spot.kind === 'train' && entry.status === 'UP' ? 1.5 : 1;
  return Math.round(spot.exposure * entry.quality * 0.5 * repMult * fitMult * trainBonus);
}

export function addPiece(run, { spotId, quality, sketch, polaroid, partnerTag }) {
  const entry = {
    id: run.pieces.length + 1,
    spotId, quality, sketch, polaroid, partnerTag,
    dayUp: run.day,
    status: 'UP',      // UP | BUFFED | CAPPED | FADED
    earned: 0,
    age: 0,
  };
  run.pieces.push(entry);
  run.piecesDone++;
  return entry;
}

// One day passes: every live piece earns; buff/cap/fade rolls happen.
export function advanceDay(run) {
  run.day++;
  run.news = [];
  for (const e of run.pieces) {
    if (e.status !== 'UP') continue;
    e.age++;
    const rate = pointsPerDay(run, e);
    e.earned += rate;
    run.score += rate;
    const spot = SPOTS.find(s => s.id === e.spotId);
    if (run.rng() < spot.buff) {
      e.status = 'BUFFED';
      run.news.push(`THE BUFF GOT YOUR ${spot.name} PIECE`);
    } else if (run.rng() < spot.cap) {
      e.status = 'CAPPED';
      run.news.push(`A TOY CAPPED YOUR ${spot.name} PIECE`);
    } else if (e.age > 25 && run.rng() < 0.15) {
      e.status = 'FADED';
      run.score += 200; // faded with honor
      run.news.push(`YOUR ${spot.name} PIECE FADED. RESPECT. +200`);
    }
  }
}

export function livePieceCount(run) {
  return run.pieces.filter(e => e.status === 'UP').length;
}

export function dailyIncome(run) {
  return run.pieces
    .filter(e => e.status === 'UP')
    .reduce((sum, e) => sum + pointsPerDay(run, e), 0);
}

export function availableSpots(run) {
  return SPOTS.filter(s => {
    if (s.requires && (!run.partner || run.partner.tag !== s.requires)) return false;
    return !run.pieces.some(e => e.spotId === s.id && e.status === 'UP');
  });
}

// City heat rises as you get famous: shorter timers, quicker cops.
export function difficulty(run) {
  return Math.min(10, run.piecesDone);
}

// ---- High scores (localStorage) ------------------------------------------

const HS_KEY = 'burner.highscores';

export function loadHighScores() {
  try { return JSON.parse(localStorage.getItem(HS_KEY)) || []; }
  catch (e) { return []; }
}

export function saveHighScore(tag, score, piecesDone) {
  const hs = loadHighScores();
  hs.push({ tag, score, piecesDone });
  hs.sort((a, b) => b.score - a.score);
  const top = hs.slice(0, 8);
  try { localStorage.setItem(HS_KEY, JSON.stringify(top)); } catch (e) { /* private mode */ }
  return top;
}
