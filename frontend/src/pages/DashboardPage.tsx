import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ROLE_LABELS, useAuth } from '../lib/auth'
import { dashboardApi } from '../lib/filings-api'
import {
  CLIENT_TYPE_LABELS,
  FILING_STATUS_LABELS,
  type ClientType,
  type DashboardStats,
  type FilingStatus,
} from '../lib/api-types'
import Spinner from '../components/Spinner'
import { useToast, getApiErrorMessage } from '../lib/toast'

interface StatCardProps {
  label: string
  value: string | number
  hint?: string
  to?: string
}

function StatCard({ label, value, hint, to }: StatCardProps) {
  const inner = (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-semibold text-slate-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

const PIPELINE_ORDER: FilingStatus[] = [
  'PENDING',
  'DOCS_AWAITED',
  'IN_PROCESS',
  'READY',
  'FILED',
  'ACKNOWLEDGED',
  'DEFECTIVE',
]

const PIPELINE_COLORS: Record<FilingStatus, string> = {
  PENDING: 'bg-slate-200',
  DOCS_AWAITED: 'bg-amber-300',
  IN_PROCESS: 'bg-blue-400',
  READY: 'bg-cyan-400',
  FILED: 'bg-emerald-500',
  ACKNOWLEDGED: 'bg-emerald-700',
  DEFECTIVE: 'bg-red-400',
}

export default function DashboardPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dashboardApi
      .stats()
      .then(setStats)
      .catch((err) => toast.error(getApiErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [toast])

  if (!user) return null

  const pipelineTotal = stats
    ? Object.values(stats.pipeline).reduce((a, b) => a + (b ?? 0), 0)
    : 0

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

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Active Clients"
              value={stats.activeClients}
              hint={`${stats.totalClients} total`}
              to="/clients?status=ACTIVE"
            />
            <StatCard
              label="Pending Filings"
              value={stats.pendingFilings}
              hint="Pending / Docs Awaited / In Process / Ready"
              to="/filings?status=PENDING"
            />
            <StatCard
              label="Filed This Month"
              value={stats.filedThisMonth}
              hint="Based on filed date"
            />
            <StatCard label="Documents" value="—" hint="Coming in next batch" />
          </div>

          {/* Clients by type — clickable cards drill into a filtered list */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-medium text-slate-900">Clients by type</h2>
            <p className="mt-1 mb-3 text-xs text-slate-500">
              Click any card to open the matching client list.
            </p>
            {(() => {
              const breakdown = stats.clientTypeBreakdown ?? {}
              const types = (Object.keys(CLIENT_TYPE_LABELS) as ClientType[])
                .map((t) => ({ type: t, count: breakdown[t] ?? 0 }))
                .filter((row) => row.count > 0)
                .sort((a, b) => b.count - a.count)

              if (types.length === 0) {
                return (
                  <div className="rounded-md border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                    No clients yet. Add some to see the type breakdown here.
                  </div>
                )
              }
              return (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {types.map(({ type, count }) => (
                    <Link
                      key={type}
                      to={`/clients?type=${type}`}
                      className="block rounded-md border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-blue-300 hover:bg-blue-50"
                    >
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {CLIENT_TYPE_LABELS[type]}
                      </div>
                      <div className="mt-1 text-2xl font-semibold text-slate-900">{count}</div>
                    </Link>
                  ))}
                </div>
              )
            })()}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-medium text-slate-900">Filings by status</h2>
            <p className="mt-1 mb-3 text-xs text-slate-500">
              {pipelineTotal > 0
                ? `${pipelineTotal} filings for active clients across all assessment years. Click any card to drill in.`
                : 'No filings yet for active clients.'}
            </p>
            {pipelineTotal > 0 ? (
              <>
                <div className="mb-4 flex h-3 overflow-hidden rounded-full">
                  {PIPELINE_ORDER.map((s) => {
                    const count = stats.pipeline[s] ?? 0
                    if (!count) return null
                    const pct = (count / pipelineTotal) * 100
                    return (
                      <div
                        key={s}
                        className={PIPELINE_COLORS[s]}
                        style={{ width: `${pct}%` }}
                        title={`${FILING_STATUS_LABELS[s]}: ${count}`}
                      />
                    )
                  })}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {PIPELINE_ORDER.map((s) => {
                    const count = stats.pipeline[s] ?? 0
                    if (!count) return null
                    return (
                      <Link
                        key={s}
                        to={`/filings?status=${s}`}
                        className="block rounded-md border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-blue-300 hover:bg-blue-50"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`inline-block h-2 w-2 rounded-full ${PIPELINE_COLORS[s]}`} />
                          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            {FILING_STATUS_LABELS[s]}
                          </span>
                        </div>
                        <div className="mt-1 text-2xl font-semibold text-slate-900">{count}</div>
                      </Link>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="rounded-md border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                Add a filing to see status counts here.
              </div>
            )}
          </div>
        </>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-medium text-slate-900">Phase 1 — Build progress</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li className="flex items-center gap-2">
            <span className="text-emerald-600">✓</span> Auth, 2FA, dashboard shell, RBAC, RLS
          </li>
          <li className="flex items-center gap-2">
            <span className="text-emerald-600">✓</span> Client master, encrypted credential vault,
            audit log
          </li>
          <li className="flex items-center gap-2">
            <span className="text-emerald-600">✓</span> ITR filings, status pipeline, multi-year
            tracking
          </li>
          <li className="flex items-center gap-2 text-slate-400">
            <span>○</span> Excel import + reports + export
          </li>
          <li className="flex items-center gap-2 text-slate-400">
            <span>○</span> User / branch management UI
          </li>
          <li className="flex items-center gap-2 text-slate-400">
            <span>○</span> Deployment to Ubuntu VPS
          </li>
        </ul>
      </div>
    </div>
  )
}
