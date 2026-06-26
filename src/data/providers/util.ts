/**
 * Route a target URL through an optional generic CORS proxy.
 *
 * Only the placeholder form (`https://proxy/?url={url}`) is honoured here — the
 * encoded target replaces `{url}`. Origin-prefix proxies (e.g. a Cloudflare
 * Worker that mirrors a single API origin) are provider-specific and skipped,
 * because appending one provider's path to another's proxy origin would break
 * the request. Providers that ship their own origin-prefix proxy handle it
 * themselves (see FootballDataProvider.applyCorsProxy).
 */
export function routeThroughProxy(target: string, proxy?: string): string {
  if (proxy && proxy.includes('{url}')) {
    return proxy.replace('{url}', encodeURIComponent(target));
  }
  return target;
}
