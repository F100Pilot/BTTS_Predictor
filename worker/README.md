# CORS Proxy Worker (Football-Data.org)

Cloudflare Worker that lets the PWA call Football-Data.org from the browser
(which otherwise blocks it for lack of CORS headers). Your API key is sent
per-request by the app and is **not** stored here.

Hardened so it isn't a free open proxy: it only forwards Football-Data API
paths (`/v4/...`) and only answers requests whose `Origin` is the app's own
origin (see `ALLOWED_ORIGINS` in [`src/index.js`](src/index.js) — update it if
you serve the app from a different domain).

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

## Cross-device sync (history & bets) — enable KV

The worker also stores your **history and bets** so they sync across devices
(`/sync` endpoint). This needs a Cloudflare **KV namespace**. Do it once:

1. Create the namespace (prints an `id`):
   ```bash
   cd worker
   npx wrangler kv namespace create SYNC
   ```
2. In [`wrangler.toml`](wrangler.toml), **uncomment** the `[[kv_namespaces]]`
   block and paste the printed `id`.
3. Commit & push (auto-deploys), or `npx wrangler deploy` manually.
4. In the app: **Definições → Sincronização entre dispositivos**, set the same
   **código de sincronização** on every device. The Proxy CORS must point at
   this worker.

Until the KV block is set, `/sync` replies `503` and everything else keeps
working. The sync code is a shared secret that namespaces your data (the worker
stores it under a SHA-256 hash of the code); anyone with the code can read it,
so use a long, private phrase.

## Manual deploy (optional)

```bash
cd worker
npx wrangler deploy
```
