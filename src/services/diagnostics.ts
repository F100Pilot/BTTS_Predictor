import { applyCorsProxy } from '@/data/providers/footballData/FootballDataProvider';
import { todayIso } from '@/lib/format';
import { createLogger } from '@/services/logger';

const log = createLogger('diagnostics');
const BASE = 'https://api.football-data.org/v4';

export interface DiagCheck {
  label: string;
  ok: boolean;
  detail: string;
}

export interface DiagInput {
  apiKey?: string;
  corsProxy?: string;
}

interface CallResult {
  status: number;
  ok: boolean;
  body: unknown;
  networkError?: string;
}

async function call(path: string, input: DiagInput): Promise<CallResult> {
  const url = applyCorsProxy(`${BASE}${path}`, input.corsProxy);
  try {
    const res = await fetch(url, {
      headers: input.apiKey ? { 'X-Auth-Token': input.apiKey } : {},
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { status: res.status, ok: res.ok, body };
  } catch (err) {
    log.warn('diagnostic call failed', { path, err });
    return {
      status: 0,
      ok: false,
      body: null,
      networkError: err instanceof Error ? err.message : 'erro de rede',
    };
  }
}

function nextWeekIso(): string {
  const d = new Date(`${todayIso()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

function describeStatus(status: number, networkError?: string): string {
  if (networkError) return `erro de rede / CORS (${networkError})`;
  if (status === 0) return 'sem resposta';
  if (status === 400) return 'HTTP 400 — pedido inválido (plano/intervalo de datas)';
  if (status === 403) return 'HTTP 403 — não autorizado para o teu plano';
  if (status === 429) return 'HTTP 429 — limite de pedidos atingido (espera 1 min)';
  return `HTTP ${status}`;
}

function countMatches(body: unknown): number | null {
  if (body && typeof body === 'object' && 'matches' in body) {
    const m = (body as { matches?: unknown }).matches;
    return Array.isArray(m) ? m.length : null;
  }
  return null;
}

/**
 * Runs a sequence of real requests against Football-Data.org (through the
 * configured CORS proxy + key) and returns human-readable check results.
 */
export async function runFootballDataDiagnostics(input: DiagInput): Promise<DiagCheck[]> {
  const checks: DiagCheck[] = [];

  checks.push({
    label: 'Chave de API',
    ok: Boolean(input.apiKey),
    detail: input.apiKey ? 'configurada' : 'em falta — configure a chave',
  });
  checks.push({
    label: 'Proxy CORS',
    ok: true,
    detail: input.corsProxy
      ? input.corsProxy
      : 'não definido (pedido direto — provável bloqueio CORS)',
  });

  // 1) Competitions — sanity check for connectivity + key.
  const comps = await call('/competitions', input);
  checks.push({
    label: 'Ligação (competições)',
    ok: comps.ok,
    detail: comps.ok
      ? 'OK — proxy e chave a responder'
      : describeStatus(comps.status, comps.networkError),
  });
  if (!comps.ok) return checks; // no point continuing if base connectivity fails

  // 2) Matches today.
  const today = todayIso();
  const todayRes = await call(`/matches?dateFrom=${today}&dateTo=${today}`, input);
  const todayCount = countMatches(todayRes.body);
  checks.push({
    label: 'Jogos hoje',
    ok: todayRes.ok,
    detail: todayRes.ok
      ? `${todayCount ?? 0} jogo(s) nas competições do teu plano`
      : describeStatus(todayRes.status, todayRes.networkError),
  });

  // 3) Matches over the next 7 days (to find any upcoming game).
  const weekRes = await call(`/matches?dateFrom=${today}&dateTo=${nextWeekIso()}`, input);
  const weekCount = countMatches(weekRes.body);
  checks.push({
    label: 'Jogos próximos 7 dias',
    ok: weekRes.ok,
    detail: weekRes.ok
      ? `${weekCount ?? 0} jogo(s) — use uma destas datas se hoje estiver vazio`
      : describeStatus(weekRes.status, weekRes.networkError),
  });

  // 4) Team history endpoint (predictions depend on it). Pick a team from results.
  const sample =
    (weekRes.body as { matches?: Array<{ homeTeam?: { id?: number; name?: string } }> })
      ?.matches?.[0]?.homeTeam ??
    (todayRes.body as { matches?: Array<{ homeTeam?: { id?: number; name?: string } }> })
      ?.matches?.[0]?.homeTeam;

  if (sample?.id) {
    const teamRes = await call(`/teams/${sample.id}/matches?status=FINISHED&limit=5`, input);
    checks.push({
      label: 'Histórico de equipa (previsões)',
      ok: teamRes.ok,
      detail: teamRes.ok
        ? `OK — ${sample.name ?? 'equipa'}: ${countMatches(teamRes.body) ?? 0} jogos`
        : `${describeStatus(teamRes.status, teamRes.networkError)} — sem isto as previsões falham`,
    });
  } else {
    checks.push({
      label: 'Histórico de equipa (previsões)',
      ok: false,
      detail: 'sem jogos para testar — escolha uma data com jogos',
    });
  }

  return checks;
}
