# CORS Proxy Worker

Cloudflare Worker that lets the PWA call external football APIs from the browser
(which otherwise blocks them for lack of CORS headers). API keys are sent
per-request by the app and are **not** stored here.

Two upstreams, selected by path prefix:

- `/sofa/...` → `https://api.sofascore.com/...` (experimental, keyless;
  SofaScore's Cloudflare bot protection may still answer 403).
- everything else → `https://api.football-data.org/...` (uses `X-Auth-Token`).

- Code: [`src/index.js`](src/index.js)
- Config: [`wrangler.toml`](wrangler.toml) — worker name `btts-proxy`

## Automatic deploy (GitHub Actions)

The workflow [`.github/workflows/deploy-worker.yml`](../.github/workflows/deploy-worker.yml)
deploys this worker automatically whenever `worker/` changes on `main`.

It needs **two GitHub secrets** (add them once):

1. **`CLOUDFLARE_API_TOKEN`** — create at
   <https://dash.cloudflare.com/profile/api-tokens> → *Create Token* → template
   **"Edit Cloudflare Workers"** → Create → copy the token.
2. **`CLOUDFLARE_ACCOUNT_ID`** — in the Cloudflare dashboard sidebar (Workers &
   Pages → Overview), or the hex id in your dashboard URL.

Add both in GitHub: repo → **Settings → Secrets and variables → Actions → New
repository secret**.

Once the secrets exist, any change to `worker/` (or a manual *Run workflow* on
the **Deploy Worker** action) updates the live `btts-proxy` worker. Without the
token the deploy step is skipped — it never fails the build.

## Manual deploy (optional)

```bash
cd worker
npx wrangler deploy
```
