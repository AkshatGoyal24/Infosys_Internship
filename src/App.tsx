import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AdminDashboard from './pages/AdminDashboard';
import AdvisorDashboard from './pages/AdvisorDashboard';
import ClientReportPage from './pages/ClientReportPage';
import Login from './pages/Login';

function ProtectedRoute({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: 'admin' | 'advisor';
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-shell">
        <p className="loading-state">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role && user.role !== role && !(role === 'advisor' && user.role === 'admin')) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }

  return <>{children}</>;
}

function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={loading ? null : user ? <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace /> : <Login />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AdvisorDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/client/:identifier"
        element={
          <ProtectedRoute>
            <ClientReportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute role="admin">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
