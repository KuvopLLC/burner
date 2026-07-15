// main.js — boot, integer-scaled canvas, input, and the scene loop.

import { W, H } from './gfx.js';
import { SCENES } from './scenes.js';
import { initAudio, resumeAudio } from './audio.js';
import { bindInput } from './input.js';

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

let scale = 1;
function fit() {
  const raw = Math.min(window.innerWidth / W, window.innerHeight / H);
  // crisp integer scale when the screen is big; fill the screen when
  // it's a phone (slightly soft beats postage-stamp)
  scale = raw >= 3 ? Math.floor(raw) : Math.max(0.5, raw);
  canvas.style.width = W * scale + 'px';
  canvas.style.height = H * scale + 'px';
}
window.addEventListener('orientationchange', () => setTimeout(fit, 250));
window.addEventListener('resize', fit);
fit();

const G = {
  frames: 0,
  run: null,
  bookReturn: null,
  mission: null,
  mouse: { x: 0, y: 0, down: false },
  scene: null,
  sceneName: '',
  go(name) {
    G.sceneName = name;
    G.scene = SCENES[name];
    if (G.scene.enter) G.scene.enter(G);
  },
};

bindInput(canvas, G, e => {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
}, () => { initAudio(); resumeAudio(); });

window.addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  if (e.repeat) return;
  initAudio(); resumeAudio();
  if (G.scene && G.scene.key) G.scene.key(G, { type: 'down', key: e.key });
});
window.addEventListener('keyup', e => {
  if (G.scene && G.scene.key) G.scene.key(G, { type: 'up', key: e.key });
});

let last = performance.now();
G.step = dt => {
  G.frames++;
  if (G.scene) {
    if (G.scene.update) G.scene.update(G, dt);
    if (G.scene.draw) G.scene.draw(G, ctx);
  }
};
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.step(dt);
  requestAnimationFrame(loop);
}

window.BURNER = G; // for the headless drive test + console poking
G.go('title');
requestAnimationFrame(loop);
