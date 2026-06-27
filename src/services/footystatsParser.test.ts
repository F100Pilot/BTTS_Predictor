import { describe, it, expect } from 'vitest';
import { parseFootystatsClub } from './footystatsParser';

// Minimal fixture mirroring the real FootyStats club page structure for
// PEPO Lappeenranta (footystats.org/clubs/pepo-lappeenranta-9748), 2026 season.
const PEPO_HTML = `
<html><head>
<meta property="og:title" content="PEPO Lappeenranta Stats, Form & xG | FootyStats" />
</head><body>
<script>var z = 'Finland'; var zz = 'PEPO Lappeenranta'; var zzz = 9748; var season = '2026';</script>
<table class='comparison-table-table w100'><thead><tr class='row header'>
<th class='item key al' scope='col'>Stats</th><th class='item stat'>Overall</th><th class='item stat'>At Home</th><th class='item stat'>At Away</th></tr></thead>
<tr class='row'><td class='item key al' scope='row'>Scored / Match</td><td class='item stat good'>1.67</td><td class='item stat great'>2.25</td><td class='item stat average'>1.2</td></tr>
<tr class='row'><td class='item key al' scope='row'>Conceded / Match</td><td class='item stat good'>1</td><td class='item stat good'>1</td><td class='item stat good'>1</td></tr>
</table>
<table class='comparison-table-table w100'>
<tr class='row'><td class='item key al' scope='row'>BTTS %</td><td class='item stat great'>89%</td><td class='item stat great'>100%</td><td class='item stat great'>80%</td></tr>
<tr class='row'><td class='item key al' scope='row'>Matches Played</td><td class='item stat null'>9</td><td class='item stat null'>4</td><td class='item stat null'>5</td></tr>
</table>
</body></html>`;

describe('parseFootystatsClub', () => {
  it('extracts the team name', () => {
    expect(parseFootystatsClub(PEPO_HTML)?.name).toBe('PEPO Lappeenranta');
  });

  it('extracts overall splits', () => {
    const t = parseFootystatsClub(PEPO_HTML)!;
    expect(t.overall).toEqual({ played: 9, goalsFor: 1.67, goalsAgainst: 1, bttsPct: 89 });
  });

  it('extracts home splits', () => {
    const t = parseFootystatsClub(PEPO_HTML)!;
    expect(t.home).toEqual({ played: 4, goalsFor: 2.25, goalsAgainst: 1, bttsPct: 100 });
  });

  it('extracts away splits', () => {
    const t = parseFootystatsClub(PEPO_HTML)!;
    expect(t.away).toEqual({ played: 5, goalsFor: 1.2, goalsAgainst: 1, bttsPct: 80 });
  });

  it('falls back to the og:title when var zz is absent', () => {
    const t = parseFootystatsClub(PEPO_HTML.replace("var zz = 'PEPO Lappeenranta';", ''))!;
    expect(t.name).toBe('PEPO Lappeenranta');
  });

  it('parses plain text copied on a phone (Select all)', () => {
    // What a mobile "Select all → Copy" yields: visible text, no HTML tags.
    const text = `PEPO Lappeenranta Stats
      Stats Overall At Home At Away
      Scored / Match 1.67 2.25 1.2
      Conceded / Match 1 1 1
      BTTS % 89% 100% 80%
      Matches Played 9 4 5`;
    const t = parseFootystatsClub(text)!;
    expect(t.home).toEqual({ played: 4, goalsFor: 2.25, goalsAgainst: 1, bttsPct: 100 });
    expect(t.away).toEqual({ played: 5, goalsFor: 1.2, goalsAgainst: 1, bttsPct: 80 });
  });

  it('returns null for unrelated HTML', () => {
    expect(parseFootystatsClub('<html><body><p>hello</p></body></html>')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parseFootystatsClub('')).toBeNull();
  });
});
