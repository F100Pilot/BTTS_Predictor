/**
 * CORS proxy for Football-Data.org, deployed as a Cloudflare Worker.
 *
 * The browser cannot call api.football-data.org directly (no CORS headers), so
 * the PWA points "Proxy CORS" at this worker. The API key is sent per-request by
 * the app (X-Auth-Token) and is NOT stored here.
 *
 * Auto-deployed by .github/workflows/deploy-worker.yml on every push that
 * changes worker/.
 */
export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors() });
    }

    // Forward everything to Football-Data.org, keeping path + query.
    const target = 'https://api.football-data.org' + url.pathname + url.search;
    const upstream = await fetch(target, {
      headers: { 'X-Auth-Token': request.headers.get('X-Auth-Token') || '' },
    });

    const headers = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(cors())) headers.set(k, v);
    return new Response(upstream.body, { status: upstream.status, headers });
  },
};

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'X-Auth-Token, Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    // Expose the quota header so the app can show remaining requests.
    'Access-Control-Expose-Headers': 'X-Requests-Available-Minute',
  };
}
