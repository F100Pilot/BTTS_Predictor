import { describe, it, expect } from 'vitest';
import { applyCorsProxy } from './FootballDataProvider';

const TARGET = 'https://api.football-data.org/v4/matches?dateFrom=2026-06-25&dateTo=2026-06-25';

describe('applyCorsProxy', () => {
  it('returns the target unchanged when no proxy is set', () => {
    expect(applyCorsProxy(TARGET)).toBe(TARGET);
    expect(applyCorsProxy(TARGET, '')).toBe(TARGET);
  });

  it('appends the path to an origin-prefix proxy (Cloudflare Worker style)', () => {
    expect(applyCorsProxy(TARGET, 'https://my-worker.workers.dev')).toBe(
      'https://my-worker.workers.dev/v4/matches?dateFrom=2026-06-25&dateTo=2026-06-25',
    );
  });

  it('trims a trailing slash on the origin-prefix proxy', () => {
    expect(applyCorsProxy(TARGET, 'https://my-worker.workers.dev/')).toBe(
      'https://my-worker.workers.dev/v4/matches?dateFrom=2026-06-25&dateTo=2026-06-25',
    );
  });

  it('substitutes the {url} placeholder with the encoded target', () => {
    expect(applyCorsProxy(TARGET, 'https://corsproxy.io/?url={url}')).toBe(
      `https://corsproxy.io/?url=${encodeURIComponent(TARGET)}`,
    );
  });
});
