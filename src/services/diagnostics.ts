import { getProvider } from '@/data/providers/registry';
import type { ProviderContext } from '@/data/providers/types';
import { todayIso } from '@/lib/format';

export interface DiagCheck {
  label: string;
  ok: boolean;
  detail: string;
}

/**
 * Connection test for a provider: tries to fetch today's fixtures (and one
 * team's recent matches) through the real provider implementation.
 */
export async function runProviderTest(
  providerId: string,
  ctx: ProviderContext,
): Promise<DiagCheck[]> {
  const provider = getProvider(providerId);
  const checks: DiagCheck[] = [
    {
      label: 'Chave de API',
      ok: provider.isConfigured(ctx),
      detail: provider.isConfigured(ctx) ? 'configurada' : 'em falta — configure a chave',
    },
  ];
  if (!provider.isConfigured(ctx)) return checks;

  try {
    const fixtures = await provider.getFixturesByDate(todayIso(), ctx);
    checks.push({
      label: `Ligação (${provider.label})`,
      ok: true,
      detail: `OK — ${fixtures.length} jogo(s) hoje`,
    });
    const fixture = fixtures[0];
    if (fixture && provider.getFixtureMatches) {
      // Match-keyed sources (Flashscore): the analysis reads both teams' form +
      // H2H from one per-fixture request, so test THAT, not getTeamRecentMatches
      // (which such providers leave empty by design).
      const bundle = await provider.getFixtureMatches(fixture, ctx);
      const total = bundle.home.length + bundle.away.length;
      checks.push({
        label: 'Forma das equipas (previsões)',
        ok: total > 0,
        detail: `${fixture.home.name} / ${fixture.away.name}: ${bundle.home.length}+${bundle.away.length} jogos`,
      });
    } else if (fixture?.home.id) {
      const recent = await provider.getTeamRecentMatches(fixture.home.id, 5, ctx);
      checks.push({
        label: 'Histórico de equipa (previsões)',
        ok: recent.length > 0,
        detail: `${fixture.home.name}: ${recent.length} jogo(s) recentes`,
      });
    }
  } catch (err) {
    checks.push({
      label: `Ligação (${provider.label})`,
      ok: false,
      detail: err instanceof Error ? err.message : 'falha na ligação (possível CORS)',
    });
  }
  return checks;
}
