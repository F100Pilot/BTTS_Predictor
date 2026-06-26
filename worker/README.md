# CORS Proxy Worker (Football-Data.org)

Cloudflare Worker that lets the PWA call Football-Data.org from the browser
(which otherwise blocks it for lack of CORS headers). Your API key is sent
per-request by the app and is **not** stored here.

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
