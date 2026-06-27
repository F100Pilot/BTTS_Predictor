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
  'footystats.org',
  'www.footystats.org',
  'betexplorer.com',
  'www.betexplorer.com',
];

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
};

export default {
  async fetch(request) {
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

    // Forward a browser-like UA (helps with anti-bot pages) plus the API key
    // when present (Football-Data).
    const upstreamHeaders = { ...BROWSER_HEADERS };
    const token = request.headers.get('X-Auth-Token');
    if (token) upstreamHeaders['X-Auth-Token'] = token;

    let upstream;
    try {
      upstream = await fetch(targetUrl.toString(), { headers: upstreamHeaders, redirect: 'follow' });
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
    'Access-Control-Allow-Headers': 'X-Auth-Token, Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    // Expose the quota header so the app can show remaining requests.
    'Access-Control-Expose-Headers': 'X-Requests-Available-Minute',
  };
}
