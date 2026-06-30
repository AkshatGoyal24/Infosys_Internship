import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ApiError,
  applyWeightsToProfiles,
  classificationCounts,
  fetchProfiles,
  fetchWeights,
  mapProfile,
  updateWeights,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import { AnalyticsCharts } from '../AnalyticsCharts';
import {
  COMPONENT_KEYS,
  COMPONENT_LABELS,
  ComponentWeightKey,
  ComponentWeights,
  PortfolioProfile,
} from '../types';

const STATUS_ORDER = ['Critical', 'Review Soon', 'Watch', 'Normal'] as const;

function weightTotal(weights: ComponentWeights): number {
  return COMPONENT_KEYS.reduce((sum, key) => sum + weights[key], 0);
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [baseProfiles, setBaseProfiles] = useState<PortfolioProfile[]>([]);
  const [savedWeights, setSavedWeights] = useState<ComponentWeights | null>(null);
  const [draftWeights, setDraftWeights] = useState<ComponentWeights | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [profileData, weightData] = await Promise.all([fetchProfiles(), fetchWeights()]);
      setBaseProfiles(profileData.map(mapProfile));
      setSavedWeights(weightData);
      setDraftWeights(weightData);
    } catch {
      setError('Failed to load admin data. Is the API server running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const draftTotal = draftWeights ? weightTotal(draftWeights) : 0;
  const isValidTotal = Math.abs(draftTotal - 1) <= 0.01;
  const hasChanges =
    savedWeights &&
    draftWeights &&
    COMPONENT_KEYS.some((key) => Math.abs(savedWeights[key] - draftWeights[key]) > 0.0001);

  const currentProfiles = useMemo(
    () => (savedWeights ? applyWeightsToProfiles(baseProfiles, savedWeights) : []),
    [baseProfiles, savedWeights],
  );

  const previewProfiles = useMemo(
    () => (draftWeights ? applyWeightsToProfiles(baseProfiles, draftWeights) : []),
    [baseProfiles, draftWeights],
  );

  const currentCounts = useMemo(() => classificationCounts(currentProfiles), [currentProfiles]);
  const previewCounts = useMemo(() => classificationCounts(previewProfiles), [previewProfiles]);

  const handleWeightChange = (key: ComponentWeightKey, percentValue: number) => {
    if (!draftWeights) return;
    const clamped = Math.max(0, Math.min(100, percentValue));
    setDraftWeights({ ...draftWeights, [key]: clamped / 100 });
    setSuccess('');
  };

  const handleReset = () => {
    if (savedWeights) {
      setDraftWeights(savedWeights);
      setSuccess('');
      setError('');
    }
  };

  const handleSave = async () => {
    if (!draftWeights || !isValidTotal) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await updateWeights(draftWeights);
      setSavedWeights(response.weights);
      setDraftWeights(response.weights);
      const refreshed = await fetchProfiles();
      setBaseProfiles(refreshed.map(mapProfile));
      setSuccess('Weights saved. All user scores have been recalculated.');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to save weights';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="app-shell">
        <p className="loading-state">Loading admin console…</p>
      </div>
    );
  }

  if (!draftWeights || !savedWeights) {
    return (
      <div className="app-shell">
        <p className="login-error">{error || 'Unable to load admin data.'}</p>
        <button type="button" className="btn-secondary" onClick={loadData}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="app-shell admin-shell">
      <header className="top-bar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true" />
          <div>
            <span className="brand-name">Meridian Wealth Management</span>
            <span className="brand-sub">System Administration</span>
          </div>
        </div>
        <div className="top-bar-actions">
          <span className="user-pill admin-pill">Admin · {user?.username}</span>
          <Link to="/dashboard" className="btn-link">
            View Advisor Dashboard
          </Link>
          <button type="button" className="btn-secondary btn-sm" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <section className="page-hero">
        <div>
          <p className="eyebrow">Admin Console</p>
          <h1>Scoring Weight Configuration</h1>
          <p className="subtitle">
            Adjust global priority score weights. Changes apply to all advisors and clients immediately.
          </p>
        </div>
      </section>

      <div className="admin-grid">
        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2>Component Weights</h2>
            <p>Set the percentage contribution for each scoring category. Total must equal 100%.</p>
          </div>

          <div className="weight-total-row">
            <span>Total allocation</span>
            <strong className={isValidTotal ? 'weight-total-valid' : 'weight-total-invalid'}>
              {(draftTotal * 100).toFixed(1)}%
            </strong>
          </div>

          <div className="weight-editor">
            {COMPONENT_KEYS.map((key) => (
              <div className="weight-row" key={key}>
                <div className="weight-row-label">
                  <span>{COMPONENT_LABELS[key]}</span>
                  <strong>{(draftWeights[key] * 100).toFixed(1)}%</strong>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(draftWeights[key] * 100)}
                  onChange={(event) => handleWeightChange(key, Number(event.target.value))}
                />
                <input
                  type="number"
                  className="weight-number"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(draftWeights[key] * 100)}
                  onChange={(event) => handleWeightChange(key, Number(event.target.value))}
                />
              </div>
            ))}
          </div>

          <div className="admin-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={!isValidTotal || !hasChanges || saving}
              onClick={handleSave}
            >
              {saving ? 'Saving…' : 'Save Weights'}
            </button>
            <button type="button" className="btn-secondary" disabled={!hasChanges || saving} onClick={handleReset}>
              Reset
            </button>
          </div>

          {error ? <p className="login-error">{error}</p> : null}
          {success ? <p className="admin-success">{success}</p> : null}
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2>Impact Preview</h2>
            <p>How alert classifications shift with your pending weight changes.</p>
          </div>

          <div className="impact-compare">
            <div className="impact-column">
              <h3>Current (saved)</h3>
              <div className="impact-kpis">
                {STATUS_ORDER.map((status) => (
                  <div className={`impact-kpi impact-${statusClassName(status)}`} key={status}>
                    <span>{status}</span>
                    <strong>{currentCounts[status] ?? 0}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="impact-arrow" aria-hidden="true">
              →
            </div>
            <div className="impact-column">
              <h3>After change</h3>
              <div className="impact-kpis">
                {STATUS_ORDER.map((status) => {
                  const before = currentCounts[status] ?? 0;
                  const after = previewCounts[status] ?? 0;
                  const delta = after - before;
                  return (
                    <div className={`impact-kpi impact-${statusClassName(status)}`} key={status}>
                      <span>{status}</span>
                      <strong>
                        {after}
                        {delta !== 0 ? (
                          <small className={delta > 0 ? 'delta-up' : 'delta-down'}>
                            {delta > 0 ? `+${delta}` : delta}
                          </small>
                        ) : null}
                      </strong>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="admin-panel admin-charts-panel">
        <div className="admin-panel-head">
          <h2>Book Health Summary</h2>
          <p>Analytics under the currently saved global weights.</p>
        </div>
        <AnalyticsCharts profiles={currentProfiles} />
      </section>
    </div>
  );
}

function statusClassName(classification: string): string {
  return classification.toLowerCase().replace(/\s+/g, '-');
}
