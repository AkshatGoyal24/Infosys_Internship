import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, fetchClientReport, mapProfile, regenerateClientReport } from '../api/client';
import {
  AllocationBars,
  ComponentScoreBreakdown,
  formatCurrency,
  formatPct,
  ProfileDetails,
  StatusBadge,
} from '../components/ProfileDetails';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from '../context/ThemeContext';
import { ClientAIReport, ComponentWeights, PortfolioProfile } from '../types';
import { exportReportPdf } from '../utils/exportReportPdf';

function UrgencyBadge({ level }: { level: ClientAIReport['urgencyLevel'] }) {
  return <span className={`urgency-badge urgency-${level}`}>{level} urgency</span>;
}

function ReportSkeleton() {
  return (
    <div className="ai-report-card ai-report-skeleton" aria-busy="true">
      <div className="skeleton-line skeleton-title" />
      <div className="skeleton-line" />
      <div className="skeleton-line skeleton-short" />
      <div className="skeleton-line" />
      <div className="skeleton-line skeleton-short" />
    </div>
  );
}

function AIReportSection({
  report,
  cached,
  onRegenerate,
  regenerating,
}: {
  report: ClientAIReport;
  cached: boolean;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const [detailLevel, setDetailLevel] = useState<'brief' | 'detailed'>('brief');
  const isDetailed = detailLevel === 'detailed';

  return (
    <section className="ai-report-card">
      <div className="ai-report-header">
        <div>
          <p className="eyebrow">AI Advisory Report</p>
          <h2>Client Summary & Recommendations</h2>
          {cached ? <p className="ai-report-meta">Loaded from cache</p> : null}
        </div>
        <div className="ai-report-header-actions">
          <div className="ai-report-view-toggle no-export" role="group" aria-label="Summary detail level">
            <button
              type="button"
              className={detailLevel === 'brief' ? 'active' : ''}
              onClick={() => setDetailLevel('brief')}
              aria-pressed={detailLevel === 'brief'}
            >
              Brief summary
            </button>
            <button
              type="button"
              className={detailLevel === 'detailed' ? 'active' : ''}
              onClick={() => setDetailLevel('detailed')}
              aria-pressed={detailLevel === 'detailed'}
            >
              Detailed summary
            </button>
          </div>
          <UrgencyBadge level={report.urgencyLevel} />
        </div>
      </div>

      <div className="ai-report-body">
        <div className="ai-report-block ai-report-summary">
          <h3>Executive Summary</h3>
          <p className="ai-report-lead">{report.executiveSummary}</p>
        </div>

        {isDetailed && report.situationAssessment ? (
          <div className="ai-report-block ai-report-assessment">
            <h3>Situation Assessment</h3>
            <p>{report.situationAssessment}</p>
          </div>
        ) : null}

        {isDetailed ? (
          <div className="ai-report-block">
            <h3>Key Concerns</h3>
            <ul className="ai-report-list">
              {report.keyConcerns.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="ai-report-block ai-report-actions">
          <h3>Recommended Actions</h3>
          <ol className="ai-report-numbered">
            {report.recommendedActions.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ol>
        </div>
      </div>

      <div className="ai-report-footer no-export">
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={onRegenerate}
          disabled={regenerating}
        >
          {regenerating ? 'Regenerating…' : 'Regenerate report'}
        </button>
      </div>
    </section>
  );
}

export default function ClientReportPage() {
  const { identifier } = useParams<{ identifier: string }>();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<PortfolioProfile | null>(null);
  const [weights, setWeights] = useState<ComponentWeights | null>(null);
  const [report, setReport] = useState<ClientAIReport | null>(null);
  const [cached, setCached] = useState(false);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const exportRef = useRef<HTMLDivElement>(null);

  const loadReport = useCallback(async () => {
    if (!identifier) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchClientReport(identifier);
      setProfile(mapProfile(data.profile));
      setWeights(data.weights);
      setReport(data.report);
      setCached(data.cached);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load client report';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [identifier]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleRegenerate = async () => {
    if (!identifier) return;
    setRegenerating(true);
    setError('');
    try {
      const data = await regenerateClientReport(identifier);
      setProfile(mapProfile(data.profile));
      setWeights(data.weights);
      setReport(data.report);
      setCached(false);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to regenerate report';
      setError(message);
    } finally {
      setRegenerating(false);
    }
  };

  const handleExportPdf = async () => {
    if (!exportRef.current || !profile) return;
    setExporting(true);
    setError('');
    try {
      await exportReportPdf(exportRef.current, profile.clientName);
    } catch {
      setError('Failed to export PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  if (!identifier) {
    return (
      <div className="app-shell">
        <p className="login-error">Invalid client identifier.</p>
        <Link to="/dashboard" className="btn-link">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="app-shell report-shell">
      <header className="top-bar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true" />
          <div>
            <span className="brand-name">Infosys Wealth Management</span>
            <span className="brand-sub">Client Advisory Report</span>
          </div>
        </div>
        <div className="top-bar-actions">
          <Link to="/dashboard" className="btn-link">
            ← Back to dashboard
          </Link>
          <ThemeToggle />
          <span className="user-pill">{user?.username}</span>
          <button type="button" className="btn-secondary btn-sm" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      {loading ? (
        <>
          <section className="report-hero report-hero-skeleton">
            <div className="skeleton-line skeleton-title" />
            <div className="skeleton-line skeleton-short" />
          </section>
          <ReportSkeleton />
        </>
      ) : error ? (
        <div className="report-error">
          <p className="login-error">{error}</p>
          <button type="button" className="btn-secondary" onClick={loadReport}>
            Retry
          </button>
        </div>
      ) : profile && weights && report ? (
        <>
          <div ref={exportRef} className="report-export-root">
            <section className="report-hero">
              <div className="report-hero-top">
                <div className="report-hero-main">
                  <p className="eyebrow">Client Report</p>
                  <h1>{profile.clientName}</h1>
                  <p className="report-hero-id">{profile.identifier}</p>
                  <div className="report-hero-metrics">
                    <StatusBadge status={profile.classification} />
                    <div className="report-hero-stat">
                      <span>Priority Score</span>
                      <strong>{profile.priorityScore.toFixed(1)}</strong>
                    </div>
                    <div className="report-hero-stat">
                      <span>Portfolio Drift</span>
                      <strong>{formatPct(profile.portfolioDriftPercent)}</strong>
                    </div>
                    <div className="report-hero-stat">
                      <span>Portfolio Value</span>
                      <strong>{formatCurrency(profile.portfolioValue)}</strong>
                    </div>
                    <div className="report-hero-stat">
                      <span>Risk Level</span>
                      <strong>{profile.riskLevel || 'N/A'}</strong>
                    </div>
                  </div>
                </div>
                <div className="report-hero-quick-actions no-export">
                  <button type="button" className="btn-action">
                    Schedule portfolio review
                  </button>
                  <button type="button" className="btn-action btn-action-outline">
                    Compare with previous review
                  </button>
                  <button
                    type="button"
                    className="btn-action btn-action-outline"
                    onClick={handleExportPdf}
                    disabled={exporting}
                  >
                    {exporting ? 'Exporting…' : 'Export summary'}
                  </button>
                </div>
              </div>
              <AllocationBars profile={profile} />
            </section>

            <section className="score-breakdown-panel">
              <ComponentScoreBreakdown profile={profile} weights={weights} />
            </section>

            <div className="report-layout">
              <AIReportSection
                report={report}
                cached={cached}
                onRegenerate={handleRegenerate}
                regenerating={regenerating}
              />

              <section className="report-details-panel">
                <div className="report-details-head">
                  <h2>Portfolio Details</h2>
                  <p>Full metrics for this client.</p>
                </div>
                <ProfileDetails profile={profile} />
              </section>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
