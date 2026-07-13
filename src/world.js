// world.js — run state: the writer, the book of pieces, strikes, and
// high scores. Score IS the count of burners you got up.

import { SPOTS } from './data.js';
import { makeRng } from './rng.js';

export function newRun(tag, seed) {
  return {
    tag, seed,
    rng: makeRng(seed ^ 0xBEEF),
    strikes: 0,
    bursts: 0,        // for the results screen
    hides: 0,
    pieces: [],       // book entries
    partner: null,    // current mission partner
    piece: null,      // current mission piece
    spot: null,       // current mission spot
  };
}

// level = how many nights you've survived; everything scales off it
export function level(run) {
  return run.pieces.length;
}

export function addPiece(run, { spotId, sketch, polaroid, partnerTag }) {
  const entry = {
    id: run.pieces.length + 1,
    spotId, sketch, polaroid, partnerTag,
    status: 'UP',    // UP | GONE (the buff catches up eventually)
  };
  run.pieces.push(entry);
  // old pieces get buffed over time, freeing the spot back up
  for (const e of run.pieces) {
    if (e.status === 'UP' && e.id <= run.pieces.length - 4) e.status = 'GONE';
  }
  return entry;
}

export function availableSpots(run) {
  return SPOTS.filter(s => {
    if (s.requires && (!run.partner || run.partner.tag !== s.requires)) return false;
    return !run.pieces.some(e => e.spotId === s.id && e.status === 'UP');
  });
}

// ---- High scores (localStorage) ------------------------------------------

const HS_KEY = 'burner.highscores.v2';

export function loadHighScores() {
  try { return JSON.parse(localStorage.getItem(HS_KEY)) || []; }
  catch (e) { return []; }
}

export function saveHighScore(tag, piecesUp) {
  const hs = loadHighScores();
  hs.push({ tag, piecesUp });
  hs.sort((a, b) => b.piecesUp - a.piecesUp);
  const top = hs.slice(0, 8);
  try { localStorage.setItem(HS_KEY, JSON.stringify(top)); } catch (e) { /* private mode */ }
  return top;
}
