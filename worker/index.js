// worker/index.js — serves the game (static assets) and the nightly
// leaderboard API. Scores live in KV under the current NYC date, so
// the board resets itself at midnight Eastern. Flood control: Turnstile
// when the client can run it, an integrity signature baked into the
// game bundle, sanity checks, and per-IP rate limits.

function nycDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

// mirror of the game's scoreSig — a post without it is just noise
function scoreSig(tag, up, ts, n) {
  let h = 2166136261 >>> 0;
  const s = tag + '.' + up + '.' + ts + '.' + n + '.' + 'BRNR86';
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
    h = ((h << 7) | (h >>> 25)) >>> 0;
    h = (h ^ 0x5EED1985) >>> 0;
  }
  return h.toString(36);
}

const JSON_HEADERS = {
  'content-type': 'application/json',
  'cache-control': 'no-store',
};

async function readBoard(env) {
  const raw = await env.SCORES.get('s:' + nycDate());
  return raw ? JSON.parse(raw) : [];
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/scores') {
      if (request.method === 'GET') {
        const board = await readBoard(env);
        return new Response(JSON.stringify({ date: nycDate(), scores: board.slice(0, 10) }), { headers: JSON_HEADERS });
      }

      if (request.method === 'POST') {
        const ip = request.headers.get('cf-connecting-ip') || 'unknown';
        let body;
        try { body = await request.json(); } catch { return bad('body'); }
        const { tag, up, ts, n, sig, tt } = body || {};

        // shape checks
        if (typeof tag !== 'string' || !/^[A-Z0-9]{2,8}$/.test(tag)) return bad('tag');
        if (!Number.isInteger(up) || up < 1 || up > 40) return bad('score');
        if (!Number.isInteger(ts) || Math.abs(Date.now() - ts) > 5 * 60 * 1000) return bad('stale');
        if (typeof n !== 'string' || n.length < 4 || n.length > 16) return bad('nonce');
        if (sig !== scoreSig(tag, up, ts, n)) return bad('sig');

        // turnstile when the client could run it; tighter limits when not
        let verified = false;
        if (tt && env.TURNSTILE_SECRET) {
          const vr = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: tt, remoteip: ip }),
          }).then(r => r.json()).catch(() => ({ success: false }));
          verified = !!vr.success;
        }

        // per-IP flood control
        const rlKey = 'rl:' + ip + ':' + nycDate();
        const used = parseInt((await env.SCORES.get(rlKey)) || '0', 10);
        const limit = verified ? 30 : 5;
        if (used >= limit) return new Response(JSON.stringify({ ok: false, err: 'later' }), { status: 429, headers: JSON_HEADERS });
        await env.SCORES.put(rlKey, String(used + 1), { expirationTtl: 90000 });

        // onto tonight's board
        const board = await readBoard(env);
        board.push({ tag, up, ts });
        board.sort((a, b) => b.up - a.up || a.ts - b.ts);
        await env.SCORES.put('s:' + nycDate(), JSON.stringify(board.slice(0, 50)), { expirationTtl: 172800 });
        return new Response(JSON.stringify({ ok: true, rank: board.findIndex(e => e.ts === ts && e.tag === tag) + 1 }), { headers: JSON_HEADERS });
      }

      return new Response('method', { status: 405 });
    }

    return env.ASSETS.fetch(request);
  },
};

function bad(err) {
  return new Response(JSON.stringify({ ok: false, err }), { status: 400, headers: JSON_HEADERS });
}
