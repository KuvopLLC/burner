// main.js — boot, integer-scaled canvas, input, and the scene loop.

import { W, H } from './gfx.js';
import { SCENES } from './scenes.js';
import { initAudio, resumeAudio } from './audio.js';

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

let scale = 1;
function fit() {
  scale = Math.max(1, Math.floor(Math.min(window.innerWidth / W, window.innerHeight / H)));
  canvas.style.width = W * scale + 'px';
  canvas.style.height = H * scale + 'px';
}
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

canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  G.mouse.x = (e.clientX - r.left) / scale;
  G.mouse.y = (e.clientY - r.top) / scale;
});
canvas.addEventListener('mousedown', e => {
  initAudio(); resumeAudio();
  G.mouse.down = true;
  if (G.scene && G.scene.click) G.scene.click(G, G.mouse.x, G.mouse.y);
});
window.addEventListener('mouseup', () => { G.mouse.down = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

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
