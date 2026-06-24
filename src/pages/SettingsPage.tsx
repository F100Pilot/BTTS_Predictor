import { useState } from 'react';
import { ExternalLink, RotateCcw, Trash2 } from 'lucide-react';
import { useSettings } from '@/store/settingsStore';
import { PROVIDERS } from '@/data/providers/registry';
import { FACTOR_LABELS, normalizeWeights, type FactorKey } from '@/core/prediction/weights';
import { clearCache } from '@/data/cache/cache';
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

export function SettingsPage() {
  const settings = useSettings();
  const [cacheCleared, setCacheCleared] = useState(false);

  const activeProvider = PROVIDERS.find((p) => p.id === settings.providerId) ?? PROVIDERS[0]!;
  const normalized = normalizeWeights(settings.weights);

  const updateWeight = (key: FactorKey, value: number): void => {
    settings.setWeights({ ...settings.weights, [key]: value });
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
            Escolha o fornecedor de dados. A fonte de demonstração funciona sem chave e offline.
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
          </div>

          {!activeProvider.capabilities.worksOffline && (
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

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.fallbackToMock}
              onChange={(e) => settings.setFallbackToMock(e.target.checked)}
              className="h-4 w-4 accent-[hsl(var(--primary))]"
            />
            Usar dados de demonstração quando a fonte falhar
          </label>
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
          <Button variant="outline" size="sm" onClick={settings.resetWeights}>
            <RotateCcw /> Repor pesos por defeito
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados & Cache</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleClearCache}>
            <Trash2 /> Limpar cache
          </Button>
          {cacheCleared && <span className="text-sm text-primary">Cache limpa.</span>}
        </CardContent>
      </Card>
    </div>
  );
}
