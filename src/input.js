// input.js — one gesture language for finger and mouse. Pointer events
// unify both into three game actions:
//   tap(x, y)   — a work order / menu advance
//   swipe up    — jump
//   swipe down  — hide
// Scenes receive tap(G, x, y) and swipe(G, dir). A scene with no tap
// handler gets a synthesized ENTER, so every menu is a button.

export const IS_TOUCH = (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) ||
  (typeof location !== 'undefined' && location.search.includes('touch'));

const SWIPE_PX = 24;      // game-pixels of travel that make a swipe
const SWIPE_MS = 400;     // within this long
const TAP_SLOP = 10;      // movement under this is still a tap

export function bindInput(canvas, G, toGame, onFirstInteract) {
  let start = null; // {x, y, t, id}

  canvas.style.touchAction = 'none';

  canvas.addEventListener('pointerdown', e => {
    onFirstInteract();
    const p = toGame(e);
    G.mouse.x = p.x; G.mouse.y = p.y;
    G.mouse.down = true;
    start = { x: p.x, y: p.y, t: performance.now(), id: e.pointerId };
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  canvas.addEventListener('pointermove', e => {
    const p = toGame(e);
    G.mouse.x = p.x; G.mouse.y = p.y;
  });

  canvas.addEventListener('pointerup', e => {
    G.mouse.down = false;
    if (!start || e.pointerId !== start.id) return;
    const p = toGame(e);
    const dx = p.x - start.x, dy = p.y - start.y;
    const dt = performance.now() - start.t;
    start = null;

    const vert = Math.abs(dy) > Math.abs(dx);
    if (dt < SWIPE_MS && Math.max(Math.abs(dx), Math.abs(dy)) >= SWIPE_PX) {
      const dir = vert ? (dy < 0 ? -1 : 1) : (dx < 0 ? -1 : 1);
      const axis = vert ? 'y' : 'x';
      if (G.scene && G.scene.swipe) G.scene.swipe(G, dir, axis);
      else if (G.scene && G.scene.key) {
        // scenes without swipe handling: a flick behaves like ENTER
        G.scene.key(G, { type: 'down', key: 'Enter' });
      }
      return;
    }
    if (Math.abs(dx) <= TAP_SLOP && Math.abs(dy) <= TAP_SLOP) {
      if (G.scene && G.scene.tap) G.scene.tap(G, p.x, p.y);
      else if (G.scene && G.scene.key) G.scene.key(G, { type: 'down', key: 'Enter' });
    }
  });

  canvas.addEventListener('pointercancel', () => {
    G.mouse.down = false;
    start = null;
  });

  canvas.addEventListener('contextmenu', e => e.preventDefault());
}
