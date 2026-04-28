import { Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import TwoFaPage from './pages/TwoFaPage'
import DashboardPage from './pages/DashboardPage'
import ClientsListPage from './pages/clients/ClientsListPage'
import ClientNewPage from './pages/clients/ClientNewPage'
import ClientDetailPage from './pages/clients/ClientDetailPage'
import FilingsListPage from './pages/filings/FilingsListPage'
import FilingPreviewPage from './pages/filings/FilingPreviewPage'
import UsersPage from './pages/admin/UsersPage'
import BranchesPage from './pages/admin/BranchesPage'
import ImportClientsPage from './pages/admin/ImportClientsPage'
import AccessPage from './pages/admin/AccessPage'
import ReportsPage from './pages/admin/ReportsPage'
import AuditLogPage from './pages/admin/AuditLogPage'
import SettingsPage from './pages/SettingsPage'
import NewsPage from './pages/NewsPage'
import Layout from './components/Layout'
import { useAuth } from './lib/auth'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        Loading…
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/2fa" element={<TwoFaPage />} />
      {/* Print-friendly preview lives outside the Layout (no sidebar/header) */}
      <Route
        path="/filings/:id/preview"
        element={
          <ProtectedRoute>
            <FilingPreviewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="clients" element={<ClientsListPage />} />
        <Route path="clients/new" element={<ClientNewPage />} />
        <Route path="clients/:id" element={<ClientDetailPage />} />
        <Route path="filings" element={<FilingsListPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="branches" element={<BranchesPage />} />
        <Route path="access" element={<AccessPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="audit" element={<AuditLogPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="news" element={<NewsPage />} />
        <Route path="clients/import" element={<ImportClientsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
