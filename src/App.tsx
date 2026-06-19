import { useEffect, useMemo, useState } from 'react';
import { PortfolioProfile } from './types';
import rawProfiles from './profiles.json';

const computeUrgency = (drift: number, status: string) => {
  const base = Math.abs(drift);
  const multiplier = status === 'Critical' ? 2.2 : status === 'Watch' ? 1.4 : 1.0;
  const bonus = status === 'Critical' ? 8 : status === 'Watch' ? 4 : 0;
  return Number((base * multiplier + bonus).toFixed(1));
};

const getStatus = (item: any) => {
  return item.classification || item.alertStatus || item.excelAlertStatus || 'Normal';
};

const mapProfile = (item: any): PortfolioProfile => {
  const drift = typeof item.portfolioDriftPercent === 'number' ? item.portfolioDriftPercent : Number(item.portfolioDriftPercent ?? item['Portfolio Drift %'] ?? 0);
  const status = getStatus(item);
  return {
    source: item.source || item.Source || undefined,
    clientName: item.clientName || item.Name || 'Unknown',
    portfolioType: item.portfolioType || item['Portfolio Type'] || 'Unknown',
    dob: item.dob || item.DOB || item['DOB'] || undefined,
    identifier: item.identifier || item.Identifier || 'Unknown',
    portfolioValue: typeof item.portfolioValue === 'number' ? item.portfolioValue : Number(item.portfolioValue ?? item['Portfolio Value'] ?? 0),
    initialInvestment: typeof item.initialInvestment === 'number' ? item.initialInvestment : Number(item.initialInvestment ?? item['Initial Investment'] ?? 0),
    equityPercent: typeof item.equityPercent === 'number' ? item.equityPercent : Number(item.equityPercent ?? item['Equity %'] ?? 0),
    fixedIncomePercent: typeof item.fixedIncomePercent === 'number' ? item.fixedIncomePercent : Number(item.fixedIncomePercent ?? item['Fixed Income %'] ?? 0),
    cashPercent: typeof item.cashPercent === 'number' ? item.cashPercent : Number(item.cashPercent ?? item['Cash %'] ?? 0),
    alternativesPercent: typeof item.alternativesPercent === 'number' ? item.alternativesPercent : Number(item.alternativesPercent ?? item['Alternatives %'] ?? 0),
    portfolioDriftPercent: drift,
    riskProfile: item.riskProfile || item['Risk Profile'] || 'Unknown',
    excelAlertStatus: item.excelAlertStatus || item['Alert Status'] || item.alertStatus || undefined,
    financialGoal: item.financialGoal || item['Financial Goal'] || '',
    equityDriftPercent: typeof item.equityDriftPercent === 'number' ? item.equityDriftPercent : Number(item.equityDriftPercent ?? item['Equity Drift %'] ?? 0),
    fixedIncomeDriftPercent: typeof item.fixedIncomeDriftPercent === 'number' ? item.fixedIncomeDriftPercent : Number(item.fixedIncomeDriftPercent ?? item['Fixed Income Drift %'] ?? 0),
    cashDriftPercent: typeof item.cashDriftPercent === 'number' ? item.cashDriftPercent : Number(item.cashDriftPercent ?? item['Cash Drift %'] ?? 0),
    alternativesDriftPercent: typeof item.alternativesDriftPercent === 'number' ? item.alternativesDriftPercent : Number(item.alternativesDriftPercent ?? item['Alternatives Drift %'] ?? 0),
    daysOutsideThreshold: typeof item.daysOutsideThreshold === 'number' ? item.daysOutsideThreshold : Number(item.daysOutsideThreshold ?? item['Days Outside Threshold'] ?? 0),
    previousDriftPercent: typeof item.previousDriftPercent === 'number' ? item.previousDriftPercent : Number(item.previousDriftPercent ?? item['Previous Drift %'] ?? 0),
    driftVelocityPercent: typeof item.driftVelocityPercent === 'number' ? item.driftVelocityPercent : Number(item.driftVelocityPercent ?? item['Drift Velocity %'] ?? 0),
    triggerCondition: item.triggerCondition || item['Trigger Condition'] || '',
    watchThreshold: typeof item.watchThreshold === 'number' ? item.watchThreshold : Number(item.watchThreshold ?? item['Watch Threshold (%)'] ?? 0),
    criticalThreshold: typeof item.criticalThreshold === 'number' ? item.criticalThreshold : Number(item.criticalThreshold ?? item['Critical Threshold (%)'] ?? 0),
    riskLevel: item.riskLevel || item['Risk Level'] || undefined,
    classification: status,
    urgencyScore: computeUrgency(drift, status),
  };
};

function App() {
  const [profiles, setProfiles] = useState<PortfolioProfile[]>([]);
  const [filter, setFilter] = useState('All');
  const [sortKey, setSortKey] = useState<'urgency' | 'drift' | 'name'>('urgency');
  const [selectedProfile, setSelectedProfile] = useState<PortfolioProfile | null>(null);

  useEffect(() => {
    setProfiles(rawProfiles.map(mapProfile));
  }, []);

  const filteredProfiles = useMemo(() => {
    return profiles
      .filter((profile) => {
        if (filter === 'All') return true;
        return profile.classification === filter;
      })
      .sort((a, b) => {
        if (sortKey === 'urgency') return b.urgencyScore - a.urgencyScore;
        if (sortKey === 'drift') return Math.abs(b.portfolioDriftPercent) - Math.abs(a.portfolioDriftPercent);
        return a.clientName.localeCompare(b.clientName);
      });
  }, [profiles, filter, sortKey]);

  const handleSelect = (profile: PortfolioProfile) => () =>
    setSelectedProfile((current) =>
      current?.identifier === profile.identifier ? null : profile
    );
  const formatPct = (value?: number) => (value != null ? `${value.toFixed(2)}%` : '—');
  const formatCurrency = (value?: number) => (value != null ? `$${value.toLocaleString()}` : '—');

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Banker Portfolio Dashboard</p>
          <h1>Client portfolios at a glance</h1>
          <p className="subtitle">
            Review portfolio drift, risk thresholds, and alert status for every client.
          </p>
        </div>
        <div className="summary-cards">
          <div className="summary-card">
            <span>Total clients</span>
            <strong>{profiles.length}</strong>
          </div>
          <div className="summary-card">
            <span>Critical</span>
            <strong>{profiles.filter((profile) => profile.classification === 'Critical').length}</strong>
          </div>
          <div className="summary-card">
            <span>Watch</span>
            <strong>{profiles.filter((profile) => profile.classification === 'Watch').length}</strong>
          </div>
        </div>
      </header>

      <section className="controls-panel">
        <div className="control-group">
          <label htmlFor="filter">Filter by status</label>
          <select id="filter" value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="All">All</option>
            <option value="Normal">Normal</option>
            <option value="Watch">Watch</option>
            <option value="Critical">Critical</option>
          </select>
        </div>
        <div className="control-group">
          <label htmlFor="sort">Sort by</label>
          <select id="sort" value={sortKey} onChange={(event) => setSortKey(event.target.value as any)}>
            <option value="urgency">Urgency</option>
            <option value="drift">Drift %</option>
            <option value="name">Client name</option>
          </select>
        </div>
      </section>

      <section className="table-shell">
        <div className="table-header">
          <span>Client</span>
          <span>Portfolio</span>
          <span>Drift %</span>
          <span>Risk</span>
          <span>Status</span>
          <span>Urgency</span>
          <span>Financial goal</span>
        </div>
        {filteredProfiles.map((profile) => {
          const isSelected = selectedProfile?.identifier === profile.identifier;
          return (
            <div key={profile.identifier}>
              <article
                className={`table-row ${profile.classification.toLowerCase()}`}
                onClick={handleSelect(profile)}
              >
                <div>
                  <strong>{profile.clientName}</strong>
                  <span>{profile.identifier}</span>
                </div>
                <div>
                  <strong>{profile.portfolioType}</strong>
                  <span>{profile.riskProfile}</span>
                </div>
                <div>{formatPct(profile.portfolioDriftPercent)}</div>
                <div>{profile.riskLevel || 'N/A'}</div>
                <div>{profile.classification}</div>
                <div>{profile.urgencyScore.toFixed(1)}</div>
                <div>{profile.financialGoal || 'No goal provided'}</div>
              </article>
              {isSelected ? (
                <article className="row-detail">
                  <div>
                    <strong>Financial goal</strong>
                    <p>{profile.financialGoal || 'Not available'}</p>
                  </div>
                  <div>
                    <strong>Status</strong>
                    <p>{profile.classification}</p>
                  </div>
                  <div>
                    <strong>Drift</strong>
                    <p>{formatPct(profile.portfolioDriftPercent)}</p>
                  </div>
                  <div>
                    <strong>Urgency</strong>
                    <p>{profile.urgencyScore.toFixed(1)}</p>
                  </div>
                  <div>
                    <strong>Watch / Critical</strong>
                    <p>{formatPct(profile.watchThreshold)} / {formatPct(profile.criticalThreshold)}</p>
                  </div>
                  <div>
                    <strong>Equity</strong>
                    <p>{formatPct(profile.equityPercent)}</p>
                  </div>
                  <div>
                    <strong>Equity drift</strong>
                    <p>{formatPct(profile.equityDriftPercent)}</p>
                  </div>
                  <div>
                    <strong>Fixed income drift</strong>
                    <p>{formatPct(profile.fixedIncomeDriftPercent)}</p>
                  </div>
                  <div>
                    <strong>Cash drift</strong>
                    <p>{formatPct(profile.cashDriftPercent)}</p>
                  </div>
                  <div>
                    <strong>Alternatives drift</strong>
                    <p>{formatPct(profile.alternativesDriftPercent)}</p>
                  </div>
                  <div>
                    <strong>Days outside threshold</strong>
                    <p>{profile.daysOutsideThreshold ?? '—'}</p>
                  </div>
                  <div>
                    <strong>Previous drift</strong>
                    <p>{formatPct(profile.previousDriftPercent)}</p>
                  </div>
                  <div>
                    <strong>Drift velocity</strong>
                    <p>{formatPct(profile.driftVelocityPercent)}</p>
                  </div>
                  <div>
                    <strong>Trigger condition</strong>
                    <p>{profile.triggerCondition || 'None'}</p>
                  </div>
                </article>
              ) : null}
            </div>
          );
        })}
      </section>
    </div>
  );
}

export default App;
