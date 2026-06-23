import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { PortfolioProfile } from './types';
import rawProfiles from './profiles.json';

const mapProfile = (item: any): PortfolioProfile => ({
  source: item.source,
  clientName: item.clientName || 'Unknown',
  portfolioType: item.portfolioType || 'Unknown',
  dob: item.dob,
  identifier: item.identifier || 'Unknown',
  portfolioValue: item.portfolioValue,
  initialInvestment: item.initialInvestment,
  equityPercent: item.equityPercent,
  fixedIncomePercent: item.fixedIncomePercent,
  cashPercent: item.cashPercent,
  alternativesPercent: item.alternativesPercent,
  portfolioDriftPercent: item.portfolioDriftPercent ?? 0,
  riskProfile: item.riskProfile || 'Unknown',
  financialGoal: item.financialGoal || '',
  equityDriftPercent: item.equityDriftPercent,
  fixedIncomeDriftPercent: item.fixedIncomeDriftPercent,
  cashDriftPercent: item.cashDriftPercent,
  alternativesDriftPercent: item.alternativesDriftPercent,
  daysOutsideThreshold: item.daysOutsideThreshold,
  previousDriftPercent: item.previousDriftPercent,
  driftVelocityPercent: item.driftVelocityPercent,
  triggerCondition: item.triggerCondition || '',
  concentrationPercent: item.concentrationPercent,
  dollarDriftEstimate: item.dollarDriftEstimate,
  watchThreshold: item.watchThreshold ?? 0,
  criticalThreshold: item.criticalThreshold ?? 0,
  riskLevel: item.riskLevel,
  componentScores: item.componentScores ?? {
    driftSeverity: 0,
    persistence: 0,
    velocity: 0,
    moneyImpact: 0,
    concentration: 0,
  },
  classification: item.classification || 'Normal',
  priorityScore: item.priorityScore ?? 0,
});

const statusClassName = (classification: string) =>
  classification.toLowerCase().replace(/\s+/g, '-');

const COMPONENT_META = [
  { key: 'driftSeverity' as const, label: 'Drift Severity', weight: 0.5 },
  { key: 'persistence' as const, label: 'Persistence', weight: 0.25 },
  { key: 'velocity' as const, label: 'Velocity', weight: 0.1 },
  { key: 'moneyImpact' as const, label: 'Money Impact', weight: 0.1 },
  { key: 'concentration' as const, label: 'Concentration', weight: 0.05 },
];

const formatPct = (value?: number) => (value != null ? `${value.toFixed(2)}%` : '—');
const formatCurrency = (value?: number) =>
  value != null ? `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—';

function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge ${statusClassName(status)}`}>{status}</span>;
}

function ComponentScoreBreakdown({ profile }: { profile: PortfolioProfile }) {
  return (
    <div className="score-breakdown">
      <div className="score-breakdown-header">
        <div>
          <h4>Priority Score Breakdown</h4>
          <p>Weighted component scores (0.00–1.00) that determine the client priority rating.</p>
        </div>
        <div className="score-breakdown-total">
          <span>Priority Score</span>
          <strong>{profile.priorityScore.toFixed(1)}</strong>
        </div>
      </div>
      <div className="score-bars">
        {COMPONENT_META.map(({ key, label, weight }) => {
          const score = profile.componentScores[key];
          const contribution = score * weight * 100;
          return (
            <div className="score-bar-row" key={key}>
              <div className="score-bar-label">
                <span>{label}</span>
                <small>{Math.round(weight * 100)}% weight</small>
              </div>
              <div className="score-bar-track-wrap">
                <div className="score-bar-track" aria-hidden="true">
                  <div
                    className="score-bar-fill"
                    style={{ width: `${Math.min(100, score * 100)}%` }}
                  />
                </div>
                <div className="score-bar-scale">
                  <span>0</span>
                  <span>1</span>
                </div>
              </div>
              <div className="score-bar-values">
                <strong>{score.toFixed(2)}</strong>
                <small>+{contribution.toFixed(1)} pts</small>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DetailSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="detail-section">
      <div className="detail-section-head">
        <h4>{title}</h4>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="detail-section-grid">{children}</div>
    </section>
  );
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="detail-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProfileCard({
  profile,
  isExpanded,
  onToggle,
}: {
  profile: PortfolioProfile;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <article className={`profile-card ${statusClassName(profile.classification)} ${isExpanded ? 'expanded' : ''}`}>
      <button type="button" className="profile-card-summary" onClick={onToggle} aria-expanded={isExpanded}>
        <div className="profile-card-top">
          <div className="profile-identity">
            <h3>{profile.clientName}</h3>
            <span className="profile-id">{profile.identifier}</span>
          </div>
          <StatusBadge status={profile.classification} />
        </div>

        <div className="profile-metrics">
          <div className="metric-tile">
            <span>Priority Score</span>
            <strong className="metric-highlight">{profile.priorityScore.toFixed(1)}</strong>
          </div>
          <div className="metric-tile">
            <span>Portfolio Drift</span>
            <strong>{formatPct(profile.portfolioDriftPercent)}</strong>
          </div>
          <div className="metric-tile">
            <span>Portfolio Value</span>
            <strong>{formatCurrency(profile.portfolioValue)}</strong>
          </div>
          <div className="metric-tile">
            <span>Risk Level</span>
            <strong>{profile.riskLevel || 'N/A'}</strong>
          </div>
        </div>

        <div className="profile-card-footer">
          <div className="profile-meta">
            <span>{profile.portfolioType}</span>
            <span className="meta-dot" aria-hidden="true" />
            <span>{profile.riskProfile} risk profile</span>
          </div>
          <span className="expand-hint">{isExpanded ? 'Hide details' : 'View details'}</span>
        </div>
      </button>

      {isExpanded ? (
        <div className="profile-card-detail">
          <ComponentScoreBreakdown profile={profile} />

          <DetailSection title="Client Overview" description="Relationship and portfolio summary">
            <DetailField label="Financial Goal" value={profile.financialGoal || 'Not available'} />
            <DetailField label="Alert Status" value={<StatusBadge status={profile.classification} />} />
            <DetailField label="Portfolio Type" value={profile.portfolioType} />
            <DetailField label="Risk Profile" value={profile.riskProfile} />
            <DetailField label="Portfolio Value" value={formatCurrency(profile.portfolioValue)} />
            <DetailField label="Initial Investment" value={formatCurrency(profile.initialInvestment)} />
          </DetailSection>

          <DetailSection title="Drift & Thresholds" description="Portfolio-level drift monitoring">
            <DetailField label="Portfolio Drift" value={formatPct(profile.portfolioDriftPercent)} />
            <DetailField label="Previous Drift" value={formatPct(profile.previousDriftPercent)} />
            <DetailField label="Drift Velocity (30D)" value={formatPct(profile.driftVelocityPercent)} />
            <DetailField label="Days Outside Threshold" value={profile.daysOutsideThreshold ?? '—'} />
            <DetailField label="Watch Threshold" value={formatPct(profile.watchThreshold)} />
            <DetailField label="Critical Threshold" value={formatPct(profile.criticalThreshold)} />
            <DetailField label="Dollar Drift Estimate" value={formatCurrency(profile.dollarDriftEstimate)} />
            <DetailField label="Concentration" value={formatPct(profile.concentrationPercent)} />
            <DetailField label="Trigger Condition" value={profile.triggerCondition || 'None'} />
          </DetailSection>

          <DetailSection title="Asset Allocation" description="Current holdings by asset class">
            <DetailField label="Equity" value={formatPct(profile.equityPercent)} />
            <DetailField label="Fixed Income" value={formatPct(profile.fixedIncomePercent)} />
            <DetailField label="Cash" value={formatPct(profile.cashPercent)} />
            <DetailField label="Alternatives" value={formatPct(profile.alternativesPercent)} />
          </DetailSection>

          <DetailSection title="Asset-Class Drift" description="Signed drift from target allocation">
            <DetailField label="Equity Drift" value={formatPct(profile.equityDriftPercent)} />
            <DetailField label="Fixed Income Drift" value={formatPct(profile.fixedIncomeDriftPercent)} />
            <DetailField label="Cash Drift" value={formatPct(profile.cashDriftPercent)} />
            <DetailField label="Alternatives Drift" value={formatPct(profile.alternativesDriftPercent)} />
          </DetailSection>
        </div>
      ) : null}
    </article>
  );
}

function App() {
  const [profiles, setProfiles] = useState<PortfolioProfile[]>([]);
  const [filter, setFilter] = useState('All');
  const [sortKey, setSortKey] = useState<'priority' | 'drift' | 'name'>('priority');
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
        if (sortKey === 'priority') return b.priorityScore - a.priorityScore;
        if (sortKey === 'drift') return Math.abs(b.portfolioDriftPercent) - Math.abs(a.portfolioDriftPercent);
        return a.clientName.localeCompare(b.clientName);
      });
  }, [profiles, filter, sortKey]);

  const statusCounts = useMemo(() => ({
    critical: profiles.filter((p) => p.classification === 'Critical').length,
    reviewSoon: profiles.filter((p) => p.classification === 'Review Soon').length,
    watch: profiles.filter((p) => p.classification === 'Watch').length,
    normal: profiles.filter((p) => p.classification === 'Normal').length,
  }), [profiles]);

  const handleSelect = (profile: PortfolioProfile) => () =>
    setSelectedProfile((current) =>
      current?.identifier === profile.identifier ? null : profile
    );

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true" />
          <div>
            <span className="brand-name">Meridian Wealth Management</span>
            <span className="brand-sub">Portfolio Oversight Console</span>
          </div>
        </div>
        <div className="top-bar-meta">
          <span>{profiles.length} active client portfolios</span>
        </div>
      </header>

      <section className="page-hero">
        <div>
          <p className="eyebrow">Advisor Dashboard</p>
          <h1>Client Portfolio Monitor</h1>
          <p className="subtitle">
            Review drift, priority scores, and alert classifications across your book of business.
          </p>
        </div>
      </section>

      <section className="kpi-strip" aria-label="Portfolio alert summary">
        <div className="kpi-card">
          <span>Total Clients</span>
          <strong>{profiles.length}</strong>
        </div>
        <div className="kpi-card kpi-critical">
          <span>Critical</span>
          <strong>{statusCounts.critical}</strong>
        </div>
        <div className="kpi-card kpi-review">
          <span>Review Soon</span>
          <strong>{statusCounts.reviewSoon}</strong>
        </div>
        <div className="kpi-card kpi-watch">
          <span>Watch</span>
          <strong>{statusCounts.watch}</strong>
        </div>
        <div className="kpi-card kpi-normal">
          <span>Normal</span>
          <strong>{statusCounts.normal}</strong>
        </div>
      </section>

      <section className="toolbar">
        <div className="toolbar-left">
          <h2>Client Portfolios</h2>
          <p>
            Showing {filteredProfiles.length} of {profiles.length} clients
            {filter !== 'All' ? ` · filtered by ${filter}` : ''}
          </p>
        </div>
        <div className="toolbar-controls">
          <div className="control-group">
            <label htmlFor="filter">Alert status</label>
            <select id="filter" value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="All">All statuses</option>
              <option value="Normal">Normal</option>
              <option value="Watch">Watch</option>
              <option value="Review Soon">Review Soon</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
          <div className="control-group">
            <label htmlFor="sort">Sort by</label>
            <select id="sort" value={sortKey} onChange={(event) => setSortKey(event.target.value as 'priority' | 'drift' | 'name')}>
              <option value="priority">Priority score (high to low)</option>
              <option value="drift">Drift % (high to low)</option>
              <option value="name">Client name (A–Z)</option>
            </select>
          </div>
        </div>
      </section>

      <section className="profile-grid">
        {filteredProfiles.length === 0 ? (
          <div className="empty-state">
            <h3>No clients match this filter</h3>
            <p>Try selecting a different alert status to view more portfolios.</p>
          </div>
        ) : (
          filteredProfiles.map((profile) => (
            <ProfileCard
              key={profile.identifier}
              profile={profile}
              isExpanded={selectedProfile?.identifier === profile.identifier}
              onToggle={handleSelect(profile)}
            />
          ))
        )}
      </section>
    </div>
  );
}

export default App;
