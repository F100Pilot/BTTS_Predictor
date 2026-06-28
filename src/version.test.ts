import { describe, expect, it } from 'vitest';
import { compareVersions, parseVersion, whatsNewSince, WHATS_NEW, APP_VERSION } from './version';

describe('parseVersion', () => {
  it('parses with and without the leading v', () => {
    expect(parseVersion('0.2.36')).toEqual([0, 2, 36]);
    expect(parseVersion('v0.2.35.1')).toEqual([0, 2, 35, 1]);
  });
});

describe('compareVersions', () => {
  it('orders by numeric segments, not string', () => {
    expect(compareVersions('0.2.36', '0.2.9')).toBeGreaterThan(0);
    expect(compareVersions('0.2.35.1', '0.2.35')).toBeGreaterThan(0);
    expect(compareVersions('0.2.35', '0.2.36')).toBeLessThan(0);
    expect(compareVersions('0.2.36', '0.2.36')).toBe(0);
  });

  it('treats missing trailing segments as zero', () => {
    expect(compareVersions('0.2.36', '0.2.36.0')).toBe(0);
    expect(compareVersions('0.2.36.1', '0.2.36')).toBeGreaterThan(0);
  });
});

describe('whatsNewSince', () => {
  it('returns only entries newer than the seen version', () => {
    // After v0.2.38.1 the device is missing the two newest entries (indices 0 and 1).
    const fresh = whatsNewSince('0.2.38.1');
    expect(fresh).toEqual([WHATS_NEW[0], WHATS_NEW[1]]);
    expect(fresh).not.toContain(WHATS_NEW[2]);
  });

  it('returns nothing when already on the current version', () => {
    expect(whatsNewSince(APP_VERSION)).toEqual([]);
  });

  it('shows only the latest entry on a first-ever launch (no seen version)', () => {
    expect(whatsNewSince(null)).toEqual([WHATS_NEW[0]]);
  });

  it('every entry carries a parseable version prefix', () => {
    for (const entry of WHATS_NEW) {
      expect(entry).toMatch(/^v[\d.]+:/);
    }
  });
});
