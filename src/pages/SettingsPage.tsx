import { useRef, useState } from 'react';
import {
  ExternalLink,
  RotateCcw,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  Upload,
} from 'lucide-react';
import { useSettings } from '@/store/settingsStore';
import { PROVIDERS } from '@/data/providers/registry';
import { FACTOR_LABELS, normalizeWeights, type FactorKey } from '@/core/prediction/weights';
import { tuneWeights, type TuneResult, type TuneSample } from '@/core/backtest/tuneWeights';
import { listHistory } from '@/data/cache/repositories';
import { clearCache } from '@/data/cache/cache';
import {
  runFootballDataDiagnostics,
  runProviderTest,
  type DiagCheck,
} from '@/services/diagnostics';
import {
  notificationsSupported,
  notificationPermission,
  requestNotificationPermission,
  showNotification,
} from '@/services/notifications';
import { exportProfile, importProfile } from '@/services/backupService';
import { syncNow, isSyncConfigured, generateSyncCode } from '@/services/syncService';
import { fetchFlashscoreQuota, type FlashscoreQuota } from '@/services/flashscoreClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { sanitizeNumber } from '@/services/sanitize';
import { round } from '@/lib/math';
import { QuotaBadge } from '@/components/common/QuotaBadge';
import { APP_VERSION } from '@/version';

export function SettingsPage() {
  const settings = useSettings();
  const [cacheCleared, setCacheCleared] = useState(false);

  const [testing, setTesting] = useState(false);
  const [checks, setChecks] = useState<DiagCheck[] | null>(null);
  const [perm, setPerm] = useState<NotificationPermission>(notificationPermission());
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [quota, setQuota] = useState<FlashscoreQuota | null>(null);
  const [quotaMsg, setQuotaMsg] = useState<string | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);

  const handleCheckQuota = async (): Promise<void> => {
    if (!settings.rapidApiKey.trim()) {
      setQuotaMsg('Indica primeiro a chave RapidAPI.');
      return;
    }
    setQuotaLoading(true);
    setQuotaMsg(null);
    setQuota(null);
    try {
      const q = await fetchFlashscoreQuota(settings.rapidApiKey, settings.corsProxy);
      setQuota(q);
      if (q.limit == null && q.remaining == null) {
        setQuotaMsg('Pedido ok, mas o RapidAPI não devolveu cabeçalhos de quota neste plano.');
      }
    } catch {
      setQuotaMsg('Falha ao verificar (Proxy CORS, chave ou limite atingido).');
    } finally {
      setQuotaLoading(false);
    }
  };

  const handleSyncNow = async (): Promise<void> => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await syncNow();
      setSyncMsg(
        res.ok
          ? 'Sincronizado ✓'
          : 'Configura o código de sincronização e o Proxy CORS (o teu Worker) primeiro.',
      );
    } catch {
      setSyncMsg('Falhou a sincronização. Verifica o Worker (KV configurado?) e o código.');
    } finally {
      setSyncing(false);
    }
  };

  const handleImport = async (file: File): Promise<void> => {
    try {
      await importProfile(file);
      setImportMsg('Perfil importado. A recarregar...');
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      setImportMsg('Ficheiro inválido.');
    }
  };

  const handleEnableNotifications = async (enabled: boolean): Promise<void> => {
    if (enabled) {
      const result = await requestNotificationPermission();
      setPerm(result);
      if (result !== 'granted') {
        settings.setNotify({ notifyEnabled: false });
        return;
      }
    }
    settings.setNotify({ notifyEnabled: enabled });
  };

  const activeProvider = PROVIDERS.find((p) => p.id === settings.providerId) ?? PROVIDERS[0]!;
  const normalized = normalizeWeights(settings.weights);

  const handleTest = async (): Promise<void> => {
    setTesting(true);
    setChecks(null);
    try {
      const ctx = {
        apiKey: settings.apiKeys[settings.providerId],
        corsProxy: settings.corsProxy,
      };
      const result =
        settings.providerId === 'football-data'
          ? await runFootballDataDiagnostics(ctx)
          : await runProviderTest(settings.providerId, ctx);
      setChecks(result);
    } finally {
      setTesting(false);
    }
  };

  const updateWeight = (key: FactorKey, value: number): void => {
    settings.setWeights({ ...settings.weights, [key]: value });
  };

  const [tuneResult, setTuneResult] = useState<TuneResult | null>(null);
  const [tuneMsg, setTuneMsg] = useState<string | null>(null);

  const handleTune = async (): Promise<void> => {
    setTuneMsg(null);
    setTuneResult(null);
    const records = await listHistory(2000);
    const samples: TuneSample[] = records
      .filter((r) => (r.actual === 'yes' || r.actual === 'no') && r.factorScores)
      .map((r) => ({
        scores: r.factorScores as TuneSample['scores'],
        outcome: r.actual === 'yes' ? 1 : 0,
      }));
    if (samples.length < 20) {
      setTuneMsg(
        `Precisas de pelo menos 20 jogos com resultado real e fatores registados (tens ${samples.length}).`,
      );
      return;
    }
    setTuneResult(tuneWeights(samples, settings.weights));
  };

  const handleClearCache = async (): Promise<void> => {
    await clearCache();
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 2500);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Definições</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fonte de Dados</CardTitle>
          <CardDescription>
            Escolha o fornecedor de dados (requer chave e Proxy CORS).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Fornecedor ativo</Label>
            <Select value={settings.providerId} onValueChange={settings.setProvider}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Qual escolher: <strong>API-Football</strong> para torneios de seleções (Mundial/Euro)
              — tem histórico mais completo das seleções (limite: 100 pedidos/dia).{' '}
              <strong>Football-Data.org</strong> para a época de clubes — limite por minuto (nunca
              fica preso) e cobre as grandes ligas. Usa <em>uma</em> fonte de cada vez: cada
              fornecedor tem IDs próprios, por isso jogos e histórico têm de vir da mesma fonte.
            </p>
          </div>

          {!activeProvider.capabilities.worksOffline && !activeProvider.capabilities.keyless && (
            <div className="space-y-1.5">
              <Label htmlFor="apikey">Chave de API ({activeProvider.label})</Label>
              <Input
                id="apikey"
                type="password"
                autoComplete="off"
                placeholder="Cole aqui a sua chave"
                value={settings.apiKeys[settings.providerId] ?? ''}
                onChange={(e) => settings.setApiKey(settings.providerId, e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                A chave é guardada apenas neste dispositivo (LocalStorage).{' '}
                {activeProvider.docsUrl && (
                  <a
                    href={activeProvider.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Obter chave <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </p>
            </div>
          )}

          {settings.providerId !== 'football-data' && (
            <div className="space-y-1.5">
              <Label htmlFor="fdlivekey">Chave Football-Data — resultados ao vivo</Label>
              <Input
                id="fdlivekey"
                type="password"
                autoComplete="off"
                placeholder="Cole aqui a chave da Football-Data"
                value={settings.apiKeys['football-data'] ?? ''}
                onChange={(e) => settings.setApiKey('football-data', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                A página Ao Vivo usa sempre a Football-Data (limite por minuto, não gasta a quota
                diária da fonte de análise). Indica aqui a chave dela, mesmo que a análise use outra
                fonte. Guardada apenas neste dispositivo.
              </p>
            </div>
          )}

          {!activeProvider.capabilities.worksOffline && (
            <div className="space-y-1.5">
              <Label htmlFor="corsproxy">Proxy CORS (opcional)</Label>
              <Input
                id="corsproxy"
                type="text"
                autoComplete="off"
                placeholder="https://o-meu-worker.workers.dev"
                value={settings.corsProxy}
                onChange={(e) => settings.setCorsProxy(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                A Football-Data.org não envia cabeçalhos CORS, por isso o browser bloqueia o pedido
                direto. Indique aqui um proxy. Formatos aceites: prefixo de origem (ex.:{' '}
                <code>https://o-meu-worker.workers.dev</code>) ou com marcador{' '}
                <code>{'https://corsproxy.io/?url={url}'}</code>. Veja{' '}
                <code>docs/CORS-PROXY.md</code> para um Cloudflare Worker gratuito.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="rapidapikey">Chave RapidAPI — Flashscore (opcional)</Label>
            <Input
              id="rapidapikey"
              type="password"
              autoComplete="off"
              placeholder="x-rapidapi-key"
              value={settings.rapidApiKey}
              onChange={(e) => settings.setRapidApiKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Usada na Calculadora para importar um jogo do Flashscore (forma das duas equipas +
              H2H) com um só pedido. Fica guardada apenas neste dispositivo. Requer o Proxy CORS
              acima apontado ao teu Worker.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleCheckQuota()}
                disabled={quotaLoading}
              >
                {quotaLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Verificar quota
              </Button>
              {quota && (quota.limit != null || quota.remaining != null) && (
                <span className="text-xs text-muted-foreground">
                  Restam{' '}
                  <span className="font-semibold text-foreground">{quota.remaining ?? '?'}</span>
                  {quota.limit != null ? ` de ${quota.limit}` : ''} pedidos no período.
                </span>
              )}
            </div>
            {quotaMsg && <p className="text-xs text-muted-foreground">{quotaMsg}</p>}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.autoFallback}
              onChange={(e) => settings.setAutoFallback(e.target.checked)}
              className="h-4 w-4 accent-[hsl(var(--primary))]"
            />
            Usar outra fonte automaticamente quando a principal falhar
          </label>
          <p className="-mt-2 pl-6 text-xs text-muted-foreground">
            Se a fonte principal falhar ou esgotar o limite, a app tenta as outras fontes que
            tiverem chave configurada (jogos e resultados ao vivo).
          </p>

          {!activeProvider.capabilities.worksOffline && (
            <div className="space-y-3 border-t pt-4">
              <div>
                <QuotaBadge />
                <p className="mt-1 text-xs text-muted-foreground">
                  Pedidos ainda disponíveis na fonte ativa (atualiza a cada chamada). Aparece em
                  branco até à primeira chamada; na web pode não estar disponível se o proxy não
                  expuser os cabeçalhos de quota.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
                {testing ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                Testar ligação
              </Button>
              {checks && (
                <ul className="space-y-1.5">
                  {checks.map((c) => (
                    <li key={c.label} className="flex items-start gap-2 text-sm">
                      {c.ok ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      ) : (
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                      )}
                      <span>
                        <span className="font-medium">{c.label}:</span>{' '}
                        <span className="text-muted-foreground">{c.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sincronização entre dispositivos</CardTitle>
          <CardDescription>
            Guarda o histórico e as apostas no teu Worker (Cloudflare KV) para aparecerem em todos
            os dispositivos. Usa o <span className="font-medium">mesmo código</span> no PC e no
            telemóvel. Requer o Proxy CORS apontado ao teu Worker (acima) e o KV configurado — ver{' '}
            <code>worker/README.md</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="synccode">Código de sincronização</Label>
            <div className="flex max-w-md gap-2">
              <Input
                id="synccode"
                type="text"
                autoComplete="off"
                placeholder="ex.: a-minha-frase-secreta-123"
                value={settings.syncCode}
                onChange={(e) => settings.setSyncCode(e.target.value)}
              />
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => settings.setSyncCode(generateSyncCode())}
              >
                Gerar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Funciona como uma palavra-passe partilhada: quem tiver este código acede a estes
              dados. Usa “Gerar” para um código forte e aleatório (recomendado), e mete o mesmo nos
              outros dispositivos. Mínimo 6 caracteres. Deixa vazio para desligar a sincronização.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => void handleSyncNow()} disabled={syncing}>
              {syncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Sincronizar agora
            </Button>
            <span className="text-xs text-muted-foreground">
              {isSyncConfigured()
                ? 'Ativa — sincroniza ao abrir, ao focar e após cada alteração.'
                : 'Inativa — falta o código ou o Proxy CORS.'}
            </span>
          </div>
          {syncMsg && <p className="text-sm text-muted-foreground">{syncMsg}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aparência</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label>Tema</Label>
            <Select value={settings.theme} onValueChange={(v) => settings.setTheme(v as never)}>
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">Sistema</SelectItem>
                <SelectItem value="light">Claro</SelectItem>
                <SelectItem value="dark">Escuro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pesos do Modelo de Previsão</CardTitle>
          <CardDescription>
            Ajuste a influência de cada fator. Os valores são normalizados para somar 100%.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(Object.keys(FACTOR_LABELS) as FactorKey[]).map((key) => (
            <div key={key} className="space-y-1">
              <div className="flex justify-between text-sm">
                <Label htmlFor={`w-${key}`}>{FACTOR_LABELS[key]}</Label>
                <span className="tabular-nums text-muted-foreground">
                  {round(normalized[key] * 100)}%
                </span>
              </div>
              <input
                id={`w-${key}`}
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={settings.weights[key]}
                onChange={(e) =>
                  updateWeight(key, sanitizeNumber(e.target.value, { min: 0, max: 1, fallback: 0 }))
                }
                className="w-full accent-[hsl(var(--primary))]"
              />
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={settings.resetWeights}>
              <RotateCcw /> Repor pesos por defeito
            </Button>
            <Button variant="outline" size="sm" onClick={() => void handleTune()}>
              Otimizar pesos com resultados
            </Button>
          </div>
          {tuneMsg && <p className="text-xs text-muted-foreground">{tuneMsg}</p>}
          {tuneResult && (
            <div className="space-y-2 rounded-md border p-3 text-sm">
              <p>
                Brier: <strong>{tuneResult.brierBefore}</strong> →{' '}
                <strong className="text-success">{tuneResult.brierAfter}</strong>{' '}
                <span className="text-xs text-muted-foreground">({tuneResult.n} jogos)</span>
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
                {(Object.keys(FACTOR_LABELS) as FactorKey[]).map((k) => (
                  <span key={k}>
                    {FACTOR_LABELS[k]}: <strong>{Math.round(tuneResult.weights[k] * 100)}%</strong>
                  </span>
                ))}
              </div>
              <Button
                size="sm"
                onClick={() => {
                  settings.setWeights(tuneResult.weights);
                  setTuneResult(null);
                  setTuneMsg('Pesos otimizados aplicados.');
                }}
              >
                Aplicar pesos otimizados
              </Button>
            </div>
          )}

          <div className="space-y-1 border-t pt-4">
            <div className="flex justify-between text-sm">
              <Label htmlFor="odds-cal">Calibração com odds de mercado</Label>
              <span className="tabular-nums text-muted-foreground">
                {round(settings.oddsCalibration * 100)}%
              </span>
            </div>
            <input
              id="odds-cal"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.oddsCalibration}
              onChange={(e) =>
                settings.setOddsCalibration(
                  sanitizeNumber(e.target.value, { min: 0, max: 1, fallback: 0 }),
                )
              }
              className="w-full accent-[hsl(var(--primary))]"
            />
            <p className="text-xs text-muted-foreground">
              Mistura a probabilidade do modelo com a probabilidade implícita nas odds (sem margem
              da casa). 0% = modelo puro; valores baixos (ex.: 20-30%) aproximam-no do mercado sem o
              copiar. Requer odds disponíveis no jogo.
            </p>
          </div>

          <label className="flex items-start gap-2 border-t pt-4 text-sm">
            <input
              type="checkbox"
              checked={settings.autoCalibrate}
              onChange={(e) => settings.setAutoCalibrate(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
            />
            <span>
              Auto-calibração pelos resultados
              <span className="block text-xs font-normal text-muted-foreground">
                A app aprende com os resultados que registar no Histórico e corrige o
                excesso/defeito de confiança das previsões (recalibração estatística). Precisa de
                pelo menos ~15 jogos com resultado real.
              </span>
            </span>
          </label>

          <div className="space-y-1 border-t pt-4">
            <Label htmlFor="batch-size">Jogos analisados por lote</Label>
            <input
              id="batch-size"
              type="number"
              min={0}
              max={200}
              step={5}
              value={settings.analysisBatchSize}
              onChange={(e) =>
                settings.setAnalysisBatchSize(
                  sanitizeNumber(e.target.value, { min: 0, max: 200, fallback: 0 }),
                )
              }
              className="w-24 rounded-md border bg-background px-2 py-1 text-sm tabular-nums"
            />
            <p className="text-xs text-muted-foreground">
              <strong>0 = analisar todos</strong> (predefinição). Se definires um valor N, a app só
              analisa os próximos N jogos a começar (por hora de início) para poupar pedidos à API,
              com um botão “Analisar mais” no painel para continuar.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notificações ao vivo</CardTitle>
          <CardDescription>
            Avisos enquanto a app está aberta (em primeiro plano ou instalada como PWA).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!notificationsSupported() ? (
            <p className="text-sm text-muted-foreground">
              Este dispositivo/navegador não suporta notificações.
            </p>
          ) : (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.notifyEnabled}
                  onChange={(e) => void handleEnableNotifications(e.target.checked)}
                  className="h-4 w-4 accent-[hsl(var(--primary))]"
                />
                Ativar notificações
              </label>
              {perm === 'denied' && (
                <p className="text-xs text-destructive">
                  Permissão negada no navegador. Autorize as notificações nas definições do site.
                </p>
              )}
              {settings.notifyEnabled && (
                <div className="space-y-2 border-l-2 pl-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={settings.notifyGoals}
                      onChange={(e) => settings.setNotify({ notifyGoals: e.target.checked })}
                      className="h-4 w-4 accent-[hsl(var(--primary))]"
                    />
                    Golos em jogos ao vivo
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={settings.notifyWatchlistBtts}
                      onChange={(e) =>
                        settings.setNotify({ notifyWatchlistBtts: e.target.checked })
                      }
                      className="h-4 w-4 accent-[hsl(var(--primary))]"
                    />
                    BTTS concretizado (jogos da Watchlist)
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={settings.notifyPregame}
                      onChange={(e) => settings.setNotify({ notifyPregame: e.target.checked })}
                      className="h-4 w-4 accent-[hsl(var(--primary))]"
                    />
                    Lembrete antes do jogo (Watchlist/Favoritos)
                  </label>
                  {settings.notifyPregame && (
                    <div className="flex items-center gap-2 pl-6 text-sm">
                      <span className="text-muted-foreground">Minutos antes:</span>
                      <Input
                        type="number"
                        min={5}
                        max={180}
                        value={settings.notifyPregameMinutes}
                        onChange={(e) =>
                          settings.setNotify({
                            notifyPregameMinutes: sanitizeNumber(e.target.value, {
                              min: 5,
                              max: 180,
                              fallback: 30,
                            }),
                          })
                        }
                        className="h-8 w-20"
                      />
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void showNotification('BTTS Analytics Pro', {
                        body: 'Notificação de teste — está tudo a funcionar! ✅',
                        tag: 'test',
                      })
                    }
                  >
                    Enviar notificação de teste
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                As notificações funcionam com a app aberta. Avisos com a app totalmente fechada
                exigiriam um servidor de push (não disponível neste alojamento estático, e
                indisponível no iOS sem isso).
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados & Cache</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleClearCache}>
              <Trash2 /> Limpar cache
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (
                  window.confirm(
                    'O ficheiro de perfil inclui as tuas chaves de API e o código de sincronização em texto simples. Guarda-o em local seguro e não o partilhes. Exportar?',
                  )
                ) {
                  void exportProfile();
                }
              }}
            >
              <Download /> Exportar perfil
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
              <Upload /> Importar perfil
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImport(file);
                e.target.value = '';
              }}
            />
          </div>
          {cacheCleared && <span className="text-sm text-primary">Cache limpa.</span>}
          {importMsg && <span className="text-sm text-primary">{importMsg}</span>}
          <p className="text-xs text-muted-foreground">
            O perfil inclui definições, favoritos, watchlist, histórico e apostas. Útil para backup
            ou mudar de dispositivo. Importar substitui os dados atuais.
          </p>
        </CardContent>
      </Card>

      <p className="pt-2 text-center text-xs text-muted-foreground">
        BTTS Analytics Pro · v{APP_VERSION}
      </p>
    </div>
  );
}
