import { ROLE_LABELS, useAuth } from '../lib/auth'

interface StatCardProps {
  label: string
  value: string
  hint: string
}

function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{hint}</div>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Welcome back, {user.name.split(' ')[0]}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          You're signed in as <strong>{ROLE_LABELS[user.role]}</strong> at{' '}
          <strong>{user.firmName}</strong>
          {user.branchName ? ` (${user.branchName})` : ''}.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Clients" value="—" hint="Coming next batch" />
        <StatCard label="Pending Filings" value="—" hint="Coming Week 3" />
        <StatCard label="Filed This Month" value="—" hint="Coming Week 3" />
        <StatCard label="Documents" value="—" hint="Coming Week 2" />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-medium text-slate-900">Phase 1 — Build progress</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li className="flex items-center gap-2">
            <span className="text-emerald-600">✓</span> Project scaffold + auth + 2FA + dashboard
            shell
          </li>
          <li className="flex items-center gap-2 text-slate-400">
            <span>○</span> Client master, encrypted credentials, Excel import
          </li>
          <li className="flex items-center gap-2 text-slate-400">
            <span>○</span> ITR filings, multi-year tracking, status pipeline
          </li>
          <li className="flex items-center gap-2 text-slate-400">
            <span>○</span> Reports, search/filter, Excel export
          </li>
        </ul>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <strong>This is the Phase 1 shell.</strong> The dashboard widgets above will populate as
        each module ships in subsequent batches.
      </div>
    </div>
  )
}
