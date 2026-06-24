import type { BttsPrediction } from '@/domain/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toPercent } from '@/lib/math';

export function FactorBreakdown({ prediction }: { prediction: BttsPrediction }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Decomposição do modelo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {prediction.factors.map((f) => (
          <div key={f.key} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium">
                {f.label}
                <span className="ml-2 text-xs text-muted-foreground">
                  peso {Math.round(f.weight * 100)}%
                </span>
              </span>
              <span className="tabular-nums text-muted-foreground">{toPercent(f.score)}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary" style={{ width: `${f.score * 100}%` }} />
            </div>
          </div>
        ))}
        <p className="pt-2 text-xs text-muted-foreground">
          Cada fator estima a probabilidade de BTTS=SIM na sua dimensão; o resultado final é a soma
          ponderada das contribuições.
        </p>
      </CardContent>
    </Card>
  );
}
