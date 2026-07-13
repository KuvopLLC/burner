// net.js — tonight's leaderboard. Scores post with an integrity
// signature and (when the widget can run) a Turnstile token; the board
// lives on the server and resets at midnight NYC time.

const SITEKEY = '0x4AAAAAAD1QsoTO1er9prQB';

function key86() { return ['B', 'R', 'N', 'R', '8', '6'].join(''); }

export function scoreSig(tag, up, ts, n) {
  let h = 2166136261 >>> 0;
  const s = tag + '.' + up + '.' + ts + '.' + n + '.' + key86();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
    h = ((h << 7) | (h >>> 25)) >>> 0;
    h = (h ^ 0x5EED1985) >>> 0;
  }
  return h.toString(36);
}

function turnstileToken() {
  return new Promise(resolve => {
    try {
      if (!window.turnstile) return resolve(null);
      const el = document.getElementById('ts-slot');
      if (!el) return resolve(null);
      el.innerHTML = '';
      const timer = setTimeout(() => resolve(null), 5000);
      window.turnstile.render(el, {
        sitekey: SITEKEY,
        callback: token => { clearTimeout(timer); resolve(token); },
        'error-callback': () => { clearTimeout(timer); resolve(null); },
      });
    } catch (e) {
      resolve(null);
    }
  });
}

export async function submitScore(tag, up) {
  try {
    const tt = await turnstileToken();
    const ts = Date.now();
    const n = Math.random().toString(36).slice(2, 10);
    const res = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tag, up, ts, n, sig: scoreSig(tag, up, ts, n), tt }),
    });
    return (await res.json()).ok === true;
  } catch (e) {
    return false;
  }
}

export async function fetchScores() {
  try {
    const res = await fetch('/api/scores', { cache: 'no-store' });
    const d = await res.json();
    return Array.isArray(d.scores) ? d.scores : null;
  } catch (e) {
    return null;
  }
}
