import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@servicedesk/ui';
import WorkspaceLayout from './components/WorkspaceLayout';
import LoginPage from './pages/LoginPage';
import QueuePage from './pages/QueuePage';
import AuditPage from './pages/AuditPage';
import AccessDeniedPage from './pages/AccessDeniedPage';

export default function App() {
  const { user, loading, can } = useAuth();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Loading&hellip;
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // The workspace is staff-only; end users are sent to the portal instead.
  if (!can('ticket.read.group') && !can('ticket.read.any')) {
    return <AccessDeniedPage />;
  }

  return (
    <WorkspaceLayout>
      <Routes>
        <Route path="/" element={<QueuePage />} />
        {can('audit.read') && <Route path="/audit" element={<AuditPage />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </WorkspaceLayout>
  );
}
