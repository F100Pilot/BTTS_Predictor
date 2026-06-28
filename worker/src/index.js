/**
 * CORS proxy deployed as a Cloudflare Worker for the BTTS Predictor PWA.
 *
 * Two jobs, one worker:
 *  1. Football-Data.org API (origin-prefix form): requests to /v4/... are
 *     forwarded to api.football-data.org with the per-request X-Auth-Token.
 *  2. Generic page fetch (?url= form): requests to /?url=<encoded target> fetch
 *     that page with a browser-like User-Agent. Used by the Calculator to pull
 *     team stats from FootyStats (and odds from BetExplorer) by link.
 *
 * The API key is sent per-request by the app and is NOT stored here.
 *
 * Hardening (so this isn't a free open proxy for anyone on the internet):
 *  - Only answers requests whose Origin is the app's own origin (allowlist).
 *  - Generic fetches are restricted to an allowlist of target hosts.
 *
 * Auto-deployed by .github/workflows/deploy-worker.yml on every push that
 * changes worker/.
 */
const ALLOWED_ORIGINS = [
  'https://f100pilot.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
];

// Hosts the generic ?url= proxy is willing to fetch. Keeps the worker from
// becoming an open proxy that anyone could abuse.
const ALLOWED_TARGET_HOSTS = [
  'api.football-data.org',
  'v3.football.api-sports.io',
  'footystats.org',
  'www.footystats.org',
  'betexplorer.com',
  'www.betexplorer.com',
  'flashscore4.p.rapidapi.com',
];

// Auth headers we forward upstream (and allow through CORS preflight).
const FORWARD_HEADERS = ['X-Auth-Token', 'x-apisports-key', 'x-rapidapi-key', 'x-rapidapi-host'];

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : '';

    // Preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors(allowOrigin) });
    }

    // Reject callers that aren't the app (CORS only protects browsers, but this
    // blocks other sites from abusing the proxy from the browser).
    if (!allowOrigin) {
      return new Response('Forbidden origin', { status: 403, headers: cors('') });
    }

    // Cross-device sync: store/read the user's history & bets in KV, namespaced
    // by a hash of their sync code.
    if (url.pathname === '/sync') {
      return handleSync(request, env, url, allowOrigin);
    }

    // Resolve the upstream target: explicit ?url= wins, else the /v4/ shortcut.
    const param = url.searchParams.get('url');
    let target;
    if (param) {
      target = param;
    } else if (url.pathname.startsWith('/v4/')) {
      target = 'https://api.football-data.org' + url.pathname + url.search;
    } else {
      return new Response('Not found', { status: 404, headers: cors(allowOrigin) });
    }

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      return new Response('Bad target URL', { status: 400, headers: cors(allowOrigin) });
    }
    if (!ALLOWED_TARGET_HOSTS.includes(targetUrl.hostname)) {
      return new Response('Target host not allowed', { status: 403, headers: cors(allowOrigin) });
    }

    // Forward a browser-like UA (helps with anti-bot pages) plus any API-key
    // headers the caller sent (Football-Data, API-Football, RapidAPI).
    const upstreamHeaders = { ...BROWSER_HEADERS };
    for (const h of FORWARD_HEADERS) {
      const v = request.headers.get(h);
      if (v) upstreamHeaders[h] = v;
    }

    let upstream;
    try {
      upstream = await fetch(targetUrl.toString(), {
        headers: upstreamHeaders,
        redirect: 'follow',
      });
    } catch {
      return new Response('Upstream fetch failed', { status: 502, headers: cors(allowOrigin) });
    }

    const headers = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(cors(allowOrigin))) headers.set(k, v);
    return new Response(upstream.body, { status: upstream.status, headers });
  },
};

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin || 'null',
    Vary: 'Origin',
    // Allow the API-key headers through the CORS preflight, else the browser
    // blocks the request before it reaches the worker ("Failed to fetch").
    'Access-Control-Allow-Headers':
      'X-Auth-Token, x-apisports-key, x-rapidapi-key, x-rapidapi-host, Content-Type',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    // Expose the quota headers so the app can show remaining requests.
    'Access-Control-Expose-Headers':
      'X-Requests-Available-Minute, x-ratelimit-requests-remaining, x-ratelimit-requests-limit',
  };
}

// ---- Cross-device sync (Cloudflare KV) ----

function syncJson(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(origin) },
  });
}

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function handleSync(request, env, url, allowOrigin) {
  // KV binding "SYNC" must exist (see worker/README.md). Without it, sync is
  // simply unavailable — the proxy keeps working.
  if (!env || !env.SYNC) {
    return syncJson({ error: 'sync-not-configured' }, 503, allowOrigin);
  }
  const code = (url.searchParams.get('code') || '').trim();
  const kind = url.searchParams.get('kind') || '';
  if (code.length < 6) return syncJson({ error: 'bad-code' }, 400, allowOrigin);
  if (kind !== 'history' && kind !== 'bets' && kind !== 'deletes') {
    return syncJson({ error: 'bad-kind' }, 400, allowOrigin);
  }
  const key = `sync:${await sha256Hex(code)}:${kind}`;

  if (request.method === 'GET') {
    const v = await env.SYNC.get(key);
    return new Response(v || 'null', {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors(allowOrigin) },
    });
  }
  if (request.method === 'PUT' || request.method === 'POST') {
    const body = await request.text();
    // Reject oversized payloads before parsing (cheaper, DoS guard).
    if (body.length > 5_000_000) return syncJson({ error: 'too-large' }, 413, allowOrigin);
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      return syncJson({ error: 'bad-json' }, 400, allowOrigin);
    }
    // Sync blobs (history/bets/deletes) are always arrays — reject anything else
    // so a stray/malicious body can't poison a user's stored data.
    if (!Array.isArray(parsed)) return syncJson({ error: 'bad-shape' }, 400, allowOrigin);
    await env.SYNC.put(key, body);
    return syncJson({ ok: true }, 200, allowOrigin);
  }
  return syncJson({ error: 'method-not-allowed' }, 405, allowOrigin);
}
