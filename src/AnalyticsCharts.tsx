import { useMemo, type ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { PortfolioProfile } from './types';

const STATUS_COLORS: Record<string, string> = {
  Normal: '#1f6b3a',
  Watch: '#9a6700',
  'Review Soon': '#b45309',
  Critical: '#b42318',
};

const CHART_COLORS = ['#1a4468', '#2d5f8f', '#4a7ab0', '#6b9fd4', '#8ec0ff', '#b8943a'];

const SCORE_BUCKETS = [
  { label: '0–19', min: 0, max: 20 },
  { label: '20–39', min: 20, max: 40 },
  { label: '40–59', min: 40, max: 60 },
  { label: '60–79', min: 60, max: 80 },
  { label: '80–100', min: 80, max: 101 },
];

function ChartCard({
  title,
  description,
  children,
  wide,
  full,
}: {
  title: string;
  description: string;
  children: ReactNode;
  wide?: boolean;
  full?: boolean;
}) {
  return (
    <article
      className={`chart-card${wide ? ' chart-card-wide' : ''}${full ? ' chart-card-full' : ''}`}
    >
      <div className="chart-card-head">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="chart-card-body">{children}</div>
    </article>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label ? <span className="chart-tooltip-label">{label}</span> : null}
      {payload.map((entry) => (
        <div key={entry.name} className="chart-tooltip-row">
          <span style={{ background: entry.color }} className="chart-tooltip-dot" />
          <span>{entry.name}</span>
          <strong>{typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsCharts({ profiles }: { profiles: PortfolioProfile[] }) {
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {
      Normal: 0,
      Watch: 0,
      'Review Soon': 0,
      Critical: 0,
    };
    profiles.forEach((p) => {
      counts[p.classification] = (counts[p.classification] ?? 0) + 1;
    });
    return Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([name, value]) => ({ name, value, fill: STATUS_COLORS[name] }));
  }, [profiles]);

  const portfolioTypeData = useMemo(() => {
    const map = new Map<string, { type: string; clients: number; avgDrift: number; totalDrift: number }>();
    profiles.forEach((p) => {
      const key = p.portfolioType;
      const existing = map.get(key) ?? { type: key, clients: 0, avgDrift: 0, totalDrift: 0 };
      existing.clients += 1;
      existing.totalDrift += Math.abs(p.portfolioDriftPercent);
      existing.avgDrift = existing.totalDrift / existing.clients;
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.clients - a.clients);
  }, [profiles]);

  const scoreDistribution = useMemo(() => {
    return SCORE_BUCKETS.map((bucket) => ({
      range: bucket.label,
      clients: profiles.filter(
        (p) => p.priorityScore >= bucket.min && p.priorityScore < bucket.max
      ).length,
    }));
  }, [profiles]);

  const componentRadar = useMemo(() => {
    if (profiles.length === 0) return [];
    const totals = { drift: 0, persist: 0, velocity: 0, money: 0, conc: 0 };
    profiles.forEach((p) => {
      totals.drift += p.componentScores.driftSeverity;
      totals.persist += p.componentScores.persistence;
      totals.velocity += p.componentScores.velocity;
      totals.money += p.componentScores.moneyImpact;
      totals.conc += p.componentScores.concentration;
    });
    const n = profiles.length;
    return [
      { component: 'Drift', score: +(totals.drift / n).toFixed(2), fullMark: 1 },
      { component: 'Persistence', score: +(totals.persist / n).toFixed(2), fullMark: 1 },
      { component: 'Velocity', score: +(totals.velocity / n).toFixed(2), fullMark: 1 },
      { component: 'Money', score: +(totals.money / n).toFixed(2), fullMark: 1 },
      { component: 'Concentration', score: +(totals.conc / n).toFixed(2), fullMark: 1 },
    ];
  }, [profiles]);

  const scatterData = useMemo(
    () =>
      profiles.map((p) => ({
        name: p.clientName,
        drift: Math.abs(p.portfolioDriftPercent),
        priority: p.priorityScore,
        aum: p.portfolioValue ?? 100000,
        status: p.classification,
        fill: STATUS_COLORS[p.classification] ?? '#4a5d73',
      })),
    [profiles]
  );

  const portfolioValueByRisk = useMemo(() => {
    const map = new Map<string, number>();
    profiles.forEach((p) => {
      const risk = p.riskLevel || p.riskProfile || 'Unknown';
      map.set(risk, (map.get(risk) ?? 0) + (p.portfolioValue ?? 0));
    });
    return Array.from(map.entries())
      .map(([risk, value]) => ({
        risk,
        value: Math.round(value / 1_000_000 * 10) / 10,
        label: `$${(value / 1_000_000).toFixed(1)}M`,
      }))
      .sort((a, b) => b.value - a.value);
  }, [profiles]);

  if (profiles.length === 0) return null;

  return (
    <section className="analytics-section" aria-label="Portfolio analytics">
      <div className="analytics-header">
        <h2>Book Analytics</h2>
        <p>Aggregate insights across your client portfolio book</p>
      </div>

      <div className="chart-grid">
        <ChartCard
          title="Alert Status Mix"
          description="Share of clients by computed alert classification"
        >
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={statusData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={62}
                outerRadius={98}
                paddingAngle={3}
                stroke="none"
              >
                {statusData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                formatter={(value) => <span className="chart-legend-text">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Avg Drift by Portfolio Type"
          description="Mean absolute drift % grouped by portfolio strategy"
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={portfolioTypeData} margin={{ top: 8, right: 8, left: -8, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dce3eb" vertical={false} />
              <XAxis
                dataKey="type"
                tick={{ fontSize: 11, fill: '#6b7f96' }}
                angle={-28}
                textAnchor="end"
                height={56}
                interval={0}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#6b7f96' }}
                unit="%"
                width={42}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload as { clients: number; avgDrift: number };
                  return (
                    <div className="chart-tooltip">
                      <span className="chart-tooltip-label">{label}</span>
                      <div className="chart-tooltip-row">
                        <span>Avg drift</span>
                        <strong>{row.avgDrift.toFixed(2)}%</strong>
                      </div>
                      <div className="chart-tooltip-row">
                        <span>Clients</span>
                        <strong>{row.clients}</strong>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="avgDrift" name="Avg drift %" radius={[6, 6, 0, 0]} maxBarSize={48}>
                {portfolioTypeData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Component Risk Profile"
          description="Book-wide average score across the five priority factors"
        >
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={componentRadar} cx="50%" cy="50%" outerRadius="72%">
              <PolarGrid stroke="#dce3eb" />
              <PolarAngleAxis dataKey="component" tick={{ fontSize: 11, fill: '#4a5d73' }} />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 1]}
                tick={{ fontSize: 10, fill: '#8fa0b3' }}
                tickCount={5}
              />
              <Radar
                name="Avg score"
                dataKey="score"
                stroke="#1a4468"
                fill="#2d5f8f"
                fillOpacity={0.35}
                strokeWidth={2}
              />
              <Tooltip content={<ChartTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Priority Score Distribution"
          description="How clients are spread across priority score bands"
          full
        >
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={scoreDistribution} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2d5f8f" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#2d5f8f" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#dce3eb" vertical={false} />
              <XAxis dataKey="range" tick={{ fontSize: 12, fill: '#6b7f96' }} />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#6b7f96' }}
                width={32}
                label={{ value: 'Clients', angle: -90, position: 'insideLeft', fill: '#8fa0b3', fontSize: 11 }}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="clients"
                name="Clients"
                stroke="#1a4468"
                strokeWidth={2.5}
                fill="url(#scoreGradient)"
                dot={{ r: 5, fill: '#1a4468', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 7 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Drift vs Priority Score"
          description="Each bubble is a client — size reflects portfolio value, color reflects alert status"
          wide
        >
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dce3eb" />
              <XAxis
                type="number"
                dataKey="drift"
                name="Drift"
                unit="%"
                tick={{ fontSize: 11, fill: '#6b7f96' }}
                label={{ value: 'Portfolio drift %', position: 'bottom', fill: '#8fa0b3', fontSize: 11, offset: -4 }}
              />
              <YAxis
                type="number"
                dataKey="priority"
                name="Priority"
                tick={{ fontSize: 11, fill: '#6b7f96' }}
                width={36}
                label={{ value: 'Priority score', angle: -90, position: 'insideLeft', fill: '#8fa0b3', fontSize: 11 }}
              />
              <ZAxis type="number" dataKey="aum" range={[50, 280]} name="AUM" />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as (typeof scatterData)[0];
                  return (
                    <div className="chart-tooltip">
                      <span className="chart-tooltip-label">{d.name}</span>
                      <div className="chart-tooltip-row">
                        <span>Drift</span>
                        <strong>{d.drift.toFixed(2)}%</strong>
                      </div>
                      <div className="chart-tooltip-row">
                        <span>Priority</span>
                        <strong>{d.priority.toFixed(1)}</strong>
                      </div>
                      <div className="chart-tooltip-row">
                        <span>Status</span>
                        <strong>{d.status}</strong>
                      </div>
                    </div>
                  );
                }}
              />
              <Scatter data={scatterData} fill="#2d5f8f">
                {scatterData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} fillOpacity={0.75} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Assets Under Management by Risk"
          description="Total portfolio value ($M) grouped by risk level"
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={portfolioValueByRisk}
              layout="vertical"
              margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#dce3eb" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: '#6b7f96' }}
                unit="M"
                label={{ value: 'USD millions', position: 'bottom', fill: '#8fa0b3', fontSize: 11, offset: -2 }}
              />
              <YAxis
                type="category"
                dataKey="risk"
                tick={{ fontSize: 12, fill: '#4a5d73' }}
                width={56}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload as { risk: string; label: string };
                  return (
                    <div className="chart-tooltip">
                      <span className="chart-tooltip-label">{row.risk} risk</span>
                      <div className="chart-tooltip-row">
                        <span>Total AUM</span>
                        <strong>{row.label}</strong>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="value" name="AUM ($M)" radius={[0, 6, 6, 0]} barSize={22} fill="#1a4468" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </section>
  );
}
