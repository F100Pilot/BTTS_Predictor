/**
 * Build a proxied URL for `target` through the configured CORS proxy.
 *  - "...{url}" form  → the encoded target replaces the {url} marker
 *  - origin-prefix    → the worker's generic ?url= endpoint is appended
 * Returns null when no proxy is configured.
 *
 * Shared by the Flashscore client and the Calculator import so the two stay in
 * sync (single source of truth for the proxy URL shape).
 */
export function proxyFor(corsProxy: string, target: string): string | null {
  const p = (corsProxy ?? '').trim();
  if (!p) return null;
  if (p.includes('{url}')) return p.replace('{url}', encodeURIComponent(target));
  return p.replace(/\/+$/, '') + '/?url=' + encodeURIComponent(target);
}
