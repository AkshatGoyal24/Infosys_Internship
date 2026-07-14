import { type ReactNode } from 'react';
import {
  COMPONENT_KEYS,
  COMPONENT_LABELS,
  ComponentWeights,
  PortfolioProfile,
} from '../types';

export const statusClassName = (classification: string) =>
  classification.toLowerCase().replace(/\s+/g, '-');

export const formatPct = (value?: number) => (value != null ? `${value.toFixed(2)}%` : '—');
export const formatCurrency = (value?: number) =>
  value != null ? `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—';

export function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge ${statusClassName(status)}`}>{status}</span>;
}

const ALLOCATION_CLASSES = [
  { label: 'Equity', currentKey: 'equityPercent', driftKey: 'equityDriftPercent' },
  { label: 'Fixed Income', currentKey: 'fixedIncomePercent', driftKey: 'fixedIncomeDriftPercent' },
  { label: 'Cash', currentKey: 'cashPercent', driftKey: 'cashDriftPercent' },
  {
    label: 'Alternatives',
    currentKey: 'alternativesPercent',
    driftKey: 'alternativesDriftPercent',
  },
] as const;

const clampPct = (value: number) => Math.max(0, Math.min(100, value));

export function AllocationBars({ profile }: { profile: PortfolioProfile }) {
  return (
    <div className="allocation-bars">
      <div className="allocation-bars-head">
        <h4>Asset Allocation vs Target</h4>
        <p>
          Current holdings by asset class. The gray marker shows the ideal target allocation.
        </p>
      </div>
      <div className="allocation-bars-list">
        {ALLOCATION_CLASSES.map((item) => {
          const current = profile[item.currentKey];
          const drift = profile[item.driftKey];
          const target =
            current != null && drift != null ? current - drift : undefined;
          const hasCurrent = current != null;

          let tagLabel = 'No data';
          let tagClass = 'on-target';
          if (drift != null) {
            if (drift > 0.05) {
              tagLabel = `+${drift.toFixed(1)}% over`;
              tagClass = 'over';
            } else if (drift < -0.05) {
              tagLabel = `${drift.toFixed(1)}% under`;
              tagClass = 'under';
            } else {
              tagLabel = 'On target';
              tagClass = 'on-target';
            }
          }

          return (
            <div className="allocation-row" key={item.label}>
              <div className="allocation-label">
                <span>{item.label}</span>
                <span className={`allocation-tag allocation-tag-${tagClass}`}>{tagLabel}</span>
              </div>
              <div className="allocation-track" aria-hidden="true">
                <div
                  className={`allocation-fill allocation-fill-${tagClass}`}
                  style={{ width: `${hasCurrent ? clampPct(current!) : 0}%` }}
                />
                {target != null ? (
                  <div
                    className="allocation-marker"
                    style={{ left: `${clampPct(target)}%` }}
                    title={`Target ${target.toFixed(1)}%`}
                  />
                ) : null}
              </div>
              <div className="allocation-values">
                <span>
                  Current <strong>{formatPct(current)}</strong>
                </span>
                <span>
                  Target <strong>{target != null ? formatPct(target) : '—'}</strong>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ComponentScoreBreakdown({
  profile,
  weights,
}: {
  profile: PortfolioProfile;
  weights: ComponentWeights;
}) {
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
        {COMPONENT_KEYS.map((key) => {
          const weight = weights[key];
          const score = profile.componentScores[key];
          const contribution = score * weight * 100;
          return (
            <div className="score-bar-row" key={key}>
              <div className="score-bar-label">
                <span>{COMPONENT_LABELS[key]}</span>
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

export function DetailSection({
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

export function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="detail-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function ProfileDetails({ profile }: { profile: PortfolioProfile }) {
  return (
    <div className="profile-details">
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
  );
}
