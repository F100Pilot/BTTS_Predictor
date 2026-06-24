import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AnalysisBundle, FormEntry } from '@/domain/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/** Build chronological chart data (oldest → newest) from both teams' form. */
function buildSeries(home: FormEntry[], away: FormEntry[]) {
  const h = [...home].reverse();
  const a = [...away].reverse();
  const length = Math.max(h.length, a.length);
  const rows: Array<{
    label: string;
    homeFor?: number;
    homeAgainst?: number;
    awayFor?: number;
    awayAgainst?: number;
    homeBtts?: number;
    awayBtts?: number;
  }> = [];
  for (let i = 0; i < length; i++) {
    rows.push({
      label: `J${i + 1}`,
      homeFor: h[i]?.goalsFor,
      homeAgainst: h[i]?.goalsAgainst,
      awayFor: a[i]?.goalsFor,
      awayAgainst: a[i]?.goalsAgainst,
      homeBtts: h[i] ? (h[i]!.btts ? 1 : 0) : undefined,
      awayBtts: a[i] ? (a[i]!.btts ? 1 : 0) : undefined,
    });
  }
  return rows;
}

const COLORS = { home: '#10b981', away: '#6366f1', against: '#ef4444', against2: '#f59e0b' };

export function AnalysisCharts({ bundle }: { bundle: AnalysisBundle }) {
  const data = buildSeries(bundle.homeStats.recentForm, bundle.awayStats.recentForm);
  const homeName = bundle.fixture.home.name;
  const awayName = bundle.fixture.away.name;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tendência BTTS (últimos jogos)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis domain={[0, 1]} ticks={[0, 1]} fontSize={11} />
              <Tooltip formatter={(v) => (v === 1 ? 'Sim' : 'Não')} />
              <Legend />
              <Line type="stepAfter" dataKey="homeBtts" name={homeName} stroke={COLORS.home} />
              <Line type="stepAfter" dataKey="awayBtts" name={awayName} stroke={COLORS.away} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Golos marcados</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis allowDecimals={false} fontSize={11} />
              <Tooltip />
              <Legend />
              <Bar dataKey="homeFor" name={homeName} fill={COLORS.home} />
              <Bar dataKey="awayFor" name={awayName} fill={COLORS.away} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Golos sofridos</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis allowDecimals={false} fontSize={11} />
              <Tooltip />
              <Legend />
              <Bar dataKey="homeAgainst" name={homeName} fill={COLORS.against} />
              <Bar dataKey="awayAgainst" name={awayName} fill={COLORS.against2} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
