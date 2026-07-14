import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchProfiles, fetchWeights, mapProfile } from '../api/client';
import {
  formatCurrency,
  formatPct,
  StatusBadge,
  statusClassName,
} from '../components/ProfileDetails';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from '../context/ThemeContext';
import { AnalyticsCharts } from '../AnalyticsCharts';
import { PortfolioProfile } from '../types';

type ProfileViewMode = 'card' | 'list';

function ProfileItem({ profile, view }: { profile: PortfolioProfile; view: ProfileViewMode }) {
  const statusClass = statusClassName(profile.classification);

  return (
    <Link
      to={`/dashboard/client/${encodeURIComponent(profile.identifier)}`}
      className={`profile-item profile-item-${view} profile-card-link ${statusClass}`}
    >
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
        <span className="expand-hint">View report →</span>
      </div>
    </Link>
  );
}

function ViewModeToggle({
  viewMode,
  onChange,
}: {
  viewMode: ProfileViewMode;
  onChange: (mode: ProfileViewMode) => void;
}) {
  return (
    <div className="view-toggle" role="group" aria-label="Profile view mode">
      <button
        type="button"
        className={viewMode === 'card' ? 'active' : ''}
        onClick={() => onChange('card')}
        aria-pressed={viewMode === 'card'}
      >
        Cards
      </button>
      <button
        type="button"
        className={viewMode === 'list' ? 'active' : ''}
        onClick={() => onChange('list')}
        aria-pressed={viewMode === 'list'}
      >
        List
      </button>
    </div>
  );
}

export default function AdvisorDashboard() {
  const { user, logout } = useAuth();
  const [profiles, setProfiles] = useState<PortfolioProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [sortKey, setSortKey] = useState<'priority' | 'drift' | 'name'>('priority');
  const [viewMode, setViewMode] = useState<ProfileViewMode>('card');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [profileData] = await Promise.all([fetchProfiles(), fetchWeights()]);
      setProfiles(profileData.map(mapProfile));
    } catch {
      setError('Failed to load portfolio data. Is the API server running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
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

  const statusCounts = useMemo(
    () => ({
      critical: profiles.filter((p) => p.classification === 'Critical').length,
      reviewSoon: profiles.filter((p) => p.classification === 'Review Soon').length,
      watch: profiles.filter((p) => p.classification === 'Watch').length,
      normal: profiles.filter((p) => p.classification === 'Normal').length,
    }),
    [profiles],
  );

  if (loading) {
    return (
      <div className="app-shell">
        <p className="loading-state">Loading portfolio data…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-shell">
        <p className="login-error">{error}</p>
        <button type="button" className="btn-secondary" onClick={loadData}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true" />
          <div>
            <span className="brand-name">Infosys Wealth Management</span>
            <span className="brand-sub">Portfolio Oversight Console</span>
          </div>
        </div>
        <div className="top-bar-actions">
          <span className="top-bar-meta">{profiles.length} active client portfolios</span>
          <span className="user-pill">{user?.username}</span>
          {user?.role === 'admin' ? (
            <Link to="/admin" className="btn-link">
              Admin Console
            </Link>
          ) : null}
          <ThemeToggle />
          <button type="button" className="btn-secondary btn-sm" onClick={logout}>
            Logout
          </button>
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

      <AnalyticsCharts profiles={profiles} />

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
            <select
              id="sort"
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as 'priority' | 'drift' | 'name')}
            >
              <option value="priority">Priority score (high to low)</option>
              <option value="drift">Drift % (high to low)</option>
              <option value="name">Client name (A–Z)</option>
            </select>
          </div>
          <div className="control-group">
            <label>View</label>
            <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
          </div>
          <button type="button" className="btn-secondary btn-sm" onClick={loadData}>
            Refresh
          </button>
        </div>
      </section>

      <section className={viewMode === 'card' ? 'profile-grid' : 'profile-list'}>
        {filteredProfiles.length === 0 ? (
          <div className="empty-state">
            <h3>No clients match this filter</h3>
            <p>Try selecting a different alert status to view more portfolios.</p>
          </div>
        ) : (
          filteredProfiles.map((profile) => (
            <ProfileItem key={profile.identifier} profile={profile} view={viewMode} />
          ))
        )}
      </section>
    </div>
  );
}
