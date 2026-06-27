/**
 * CORS proxy for Football-Data.org, deployed as a Cloudflare Worker.
 *
 * The browser cannot call api.football-data.org directly (no CORS headers), so
 * the PWA points "Proxy CORS" at this worker. The API key is sent per-request
 * by the app (X-Auth-Token) and is NOT stored here.
 *
 * Hardening (so this isn't a free open proxy for anyone on the internet):
 *  - Only forwards Football-Data API paths (/v4/...).
 *  - Only answers requests whose Origin is the app's own origin (allowlist).
 *
 * Auto-deployed by .github/workflows/deploy-worker.yml on every push that
 * changes worker/.
 */
const ALLOWED_ORIGINS = [
  'https://f100pilot.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
];

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

    // Only proxy the Football-Data API surface.
    if (!url.pathname.startsWith('/v4/')) {
      return new Response('Not found', { status: 404, headers: cors(allowOrigin) });
    }

    const target = 'https://api.football-data.org' + url.pathname + url.search;
    const upstream = await fetch(target, {
      headers: { 'X-Auth-Token': request.headers.get('X-Auth-Token') || '' },
    });

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
