import { NavLink, Outlet } from 'react-router-dom'
import { ROLE_LABELS, useAuth, type UserRole } from '../lib/auth'

interface NavItem {
  label: string
  to: string
  roles: UserRole[] // empty array = all roles
  enabled: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', roles: [], enabled: true },
  { label: 'Clients', to: '/clients', roles: [], enabled: true },
  { label: 'ITR Filings', to: '/filings', roles: [], enabled: true },
  { label: 'News & Updates', to: '/news', roles: [], enabled: true },
  {
    label: 'Branches',
    to: '/branches',
    roles: ['MANAGING_PARTNER', 'PARTNER'],
    enabled: true,
  },
  {
    label: 'Users',
    to: '/users',
    roles: ['MANAGING_PARTNER', 'PARTNER'],
    enabled: true,
  },
  {
    label: 'Access',
    to: '/access',
    roles: ['MANAGING_PARTNER', 'PARTNER'],
    enabled: true,
  },
  {
    label: 'Reports',
    to: '/reports',
    roles: ['MANAGING_PARTNER', 'PARTNER', 'BRANCH_HEAD'],
    enabled: true,
  },
  {
    label: 'Audit Log',
    to: '/audit',
    roles: ['MANAGING_PARTNER'],
    enabled: true,
  },
  { label: 'Settings', to: '/settings', roles: [], enabled: true },
]

export default function Layout() {
  const { user, logout } = useAuth()
  if (!user) return null

  const visible = NAV_ITEMS.filter(
    (item) => item.roles.length === 0 || item.roles.includes(user.role),
  )

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white">
        <div className="flex h-14 items-center border-b border-slate-200 px-4">
          <span className="text-lg font-bold text-blue-600">CA360</span>
        </div>
        <nav className="flex-1 space-y-1 px-2 py-3">
          {visible.map((item) =>
            item.enabled ? (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `block rounded-md px-3 py-2 text-sm font-medium ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ) : (
              <span
                key={item.to}
                className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-slate-400"
                title="Coming in a later phase"
              >
                {item.label}
                <span className="ml-2 text-[10px] uppercase tracking-wide text-slate-300">soon</span>
              </span>
            ),
          )}
        </nav>
        <div className="border-t border-slate-200 p-3 text-xs text-slate-400">Phase 1 — v0.1</div>
      </aside>

      {/* Main column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div>
            <div className="text-sm font-medium text-slate-900">{user.firmName}</div>
            {user.branchName && (
              <div className="text-xs text-slate-500">{user.branchName}</div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-medium text-slate-900">{user.name}</div>
              <div className="text-xs text-slate-500">{ROLE_LABELS[user.role]}</div>
            </div>
            <button
              onClick={logout}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
