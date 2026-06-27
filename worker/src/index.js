/**
 * CORS proxy deployed as a Cloudflare Worker.
 *
 * Two upstreams, selected by path prefix:
 *   - "/sofa/..."  → https://api.sofascore.com/...   (experimental, keyless)
 *   - everything else → https://api.football-data.org/...  (X-Auth-Token)
 *
 * The browser cannot call these APIs directly (no CORS headers), so the PWA
 * points "Proxy CORS" at this worker. API keys are sent per-request by the app
 * and are NOT stored here.
 *
 * NOTE: SofaScore is behind Cloudflare bot protection and may still answer 403
 * to requests coming from a Worker. This proxy is best-effort.
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

    let target;
    let upstreamHeaders;
    if (url.pathname.startsWith('/sofa/')) {
      // SofaScore: strip the "/sofa" prefix, forward the rest. Send browser-like
      // headers to improve the odds of getting past the bot check.
      target = 'https://api.sofascore.com' + url.pathname.slice('/sofa'.length) + url.search;
      upstreamHeaders = {
        Accept: 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: 'https://www.sofascore.com/',
        Origin: 'https://www.sofascore.com',
      };
    } else {
      // Football-Data.org: keep path + query, forward the API key.
      target = 'https://api.football-data.org' + url.pathname + url.search;
      upstreamHeaders = { 'X-Auth-Token': request.headers.get('X-Auth-Token') || '' };
    }

    const upstream = await fetch(target, { headers: upstreamHeaders });

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
