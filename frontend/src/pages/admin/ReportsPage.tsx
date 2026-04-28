import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  reportsApi,
  exportApi,
  type BranchWorkloadRow,
  type FilingsSummaryRow,
  type StaffWorkloadRow,
  type UpcomingDueFiling,
} from '../../lib/admin-api'
import {
  FILING_STATUS_LABELS,
  fmtDate,
  fmtINR,
  ITR_FORM_LABELS,
  type FilingStatus,
  type ItrForm,
} from '../../lib/api-types'
import { ROLE_LABELS } from '../../lib/auth'
import Spinner from '../../components/Spinner'
import { useToast, getApiErrorMessage } from '../../lib/toast'

const ALL_STATUSES: FilingStatus[] = [
  'PENDING',
  'DOCS_AWAITED',
  'IN_PROCESS',
  'READY',
  'FILED',
  'ACKNOWLEDGED',
  'DEFECTIVE',
]

function daysFromNow(dateStr: string | null): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / (24 * 3600 * 1000))
}

function UrgencyBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-slate-400">—</span>
  if (days < 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 ring-1 ring-inset ring-red-200">
        {Math.abs(days)} day{Math.abs(days) === 1 ? '' : 's'} overdue
      </span>
    )
  }
  if (days <= 7) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
        in {days} day{days === 1 ? '' : 's'}
      </span>
    )
  }
  return <span className="text-xs text-slate-600">in {days} days</span>
}

export default function ReportsPage() {
  const toast = useToast()

  const [filingsGrid, setFilingsGrid] = useState<FilingsSummaryRow[] | null>(null)
  const [staff, setStaff] = useState<StaffWorkloadRow[] | null>(null)
  const [branches, setBranches] = useState<BranchWorkloadRow[] | null>(null)
  const [upcoming, setUpcoming] = useState<UpcomingDueFiling[] | null>(null)
  const [overdue, setOverdue] = useState<UpcomingDueFiling[] | null>(null)
  const [horizon, setHorizon] = useState(30)
  const [loading, setLoading] = useState(true)

  function reload() {
    setLoading(true)
    Promise.all([
      reportsApi.filingsSummary(),
      reportsApi.workloadByStaff(),
      reportsApi.workloadByBranch(),
      reportsApi.upcomingDue(horizon),
      reportsApi.overdue(),
    ])
      .then(([a, b, c, d, e]) => {
        setFilingsGrid(a)
        setStaff(b)
        setBranches(c)
        setUpcoming(d)
        setOverdue(e)
      })
      .catch((err) => toast.error(getApiErrorMessage(err)))
      .finally(() => setLoading(false))
  }

  useEffect(reload, [horizon])

  // Build the AY × status grid for rendering
  const grid = (() => {
    if (!filingsGrid) return null
    const ays = Array.from(new Set(filingsGrid.map((r) => r.assessmentYear))).sort().reverse()
    const cells = new Map<string, FilingsSummaryRow>()
    let totalCount = 0
    let totalRefund = 0
    for (const r of filingsGrid) {
      cells.set(`${r.assessmentYear}__${r.status}`, r)
      totalCount += r.count
      totalRefund += Number(r.refundAmount ?? 0)
    }
    return { ays, cells, totalCount, totalRefund }
  })()

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
          <p className="mt-1 text-sm text-slate-500">
            All counts respect your role's scope (juniors see only assigned clients).
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() =>
              exportApi.download('/export/filings').catch((e) => toast.error(getApiErrorMessage(e)))
            }
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Export filings .xlsx
          </button>
          <button
            onClick={() =>
              exportApi.download('/export/clients').catch((e) => toast.error(getApiErrorMessage(e)))
            }
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Export clients .xlsx
          </button>
        </div>
      </div>

      {/* Overdue */}
      {overdue && overdue.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 shadow-sm">
          <h2 className="text-base font-medium text-red-900">
            ⚠ Overdue ({overdue.length})
          </h2>
          <p className="mt-1 mb-3 text-xs text-red-700">
            Past due date and not yet filed. Resolve these first.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-red-700">
                <tr>
                  <th className="py-2 text-left font-medium">Client</th>
                  <th className="py-2 text-left font-medium">AY</th>
                  <th className="py-2 text-left font-medium">Form</th>
                  <th className="py-2 text-left font-medium">Status</th>
                  <th className="py-2 text-left font-medium">Due</th>
                  <th className="py-2 text-left font-medium">Days</th>
                  <th className="py-2 text-left font-medium">Prepared by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-200">
                {overdue.map((f) => (
                  <tr key={f.id}>
                    <td className="py-2">
                      <Link to={`/clients/${f.client.id}`} className="text-indigo-700 hover:underline">
                        {f.client.name}
                      </Link>
                    </td>
                    <td className="py-2 font-mono text-xs">{f.assessmentYear}</td>
                    <td className="py-2 text-xs">{f.itrForm ? ITR_FORM_LABELS[f.itrForm as ItrForm] : '—'}</td>
                    <td className="py-2 text-xs">{FILING_STATUS_LABELS[f.status as FilingStatus]}</td>
                    <td className="py-2 text-xs">{fmtDate(f.dueDate)}</td>
                    <td className="py-2"><UrgencyBadge days={daysFromNow(f.dueDate)} /></td>
                    <td className="py-2 text-xs">{f.preparedBy?.name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upcoming due */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-medium text-slate-900">Upcoming due dates</h2>
            <p className="text-xs text-slate-500">Filings due within the selected window.</p>
          </div>
          <select
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value={7}>Next 7 days</option>
            <option value={14}>Next 14 days</option>
            <option value={30}>Next 30 days</option>
            <option value={60}>Next 60 days</option>
            <option value={90}>Next 90 days</option>
          </select>
        </div>
        {upcoming && upcoming.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 text-left font-medium">Client</th>
                  <th className="py-2 text-left font-medium">AY</th>
                  <th className="py-2 text-left font-medium">Form</th>
                  <th className="py-2 text-left font-medium">Status</th>
                  <th className="py-2 text-left font-medium">Due</th>
                  <th className="py-2 text-left font-medium">In</th>
                  <th className="py-2 text-left font-medium">Prepared by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {upcoming.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="py-2">
                      <Link to={`/clients/${f.client.id}`} className="text-indigo-700 hover:underline">
                        {f.client.name}
                      </Link>
                    </td>
                    <td className="py-2 font-mono text-xs">{f.assessmentYear}</td>
                    <td className="py-2 text-xs">{f.itrForm ? ITR_FORM_LABELS[f.itrForm as ItrForm] : '—'}</td>
                    <td className="py-2 text-xs">{FILING_STATUS_LABELS[f.status as FilingStatus]}</td>
                    <td className="py-2 text-xs">{fmtDate(f.dueDate)}</td>
                    <td className="py-2"><UrgencyBadge days={daysFromNow(f.dueDate)} /></td>
                    <td className="py-2 text-xs">{f.preparedBy?.name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
            Nothing due in the next {horizon} days.
          </div>
        )}
      </div>

      {/* Filings summary grid */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-medium text-slate-900">Filings summary by AY × status</h2>
        {grid && grid.ays.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 text-left font-medium">AY</th>
                  {ALL_STATUSES.map((s) => (
                    <th key={s} className="py-2 text-right font-medium">
                      {FILING_STATUS_LABELS[s]}
                    </th>
                  ))}
                  <th className="py-2 text-right font-medium">Total</th>
                  <th className="py-2 text-right font-medium">Refund (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {grid.ays.map((ay) => {
                  let rowTotal = 0
                  let rowRefund = 0
                  return (
                    <tr key={ay} className="hover:bg-slate-50">
                      <td className="py-2 font-mono text-xs">{ay}</td>
                      {ALL_STATUSES.map((s) => {
                        const cell = grid.cells.get(`${ay}__${s}`)
                        if (cell) {
                          rowTotal += cell.count
                          rowRefund += Number(cell.refundAmount ?? 0)
                        }
                        return (
                          <td
                            key={s}
                            className={`py-2 text-right font-mono text-xs ${cell ? '' : 'text-slate-300'}`}
                          >
                            {cell ? cell.count : '—'}
                          </td>
                        )
                      })}
                      <td className="py-2 text-right font-mono text-xs font-semibold">{rowTotal}</td>
                      <td className="py-2 text-right font-mono text-xs">{fmtINR(rowRefund)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 text-sm font-semibold">
                  <td className="py-2">Total</td>
                  {ALL_STATUSES.map((s) => {
                    const sum = grid.ays.reduce(
                      (acc, ay) => acc + (grid.cells.get(`${ay}__${s}`)?.count ?? 0),
                      0,
                    )
                    return (
                      <td key={s} className="py-2 text-right font-mono text-xs">
                        {sum || '—'}
                      </td>
                    )
                  })}
                  <td className="py-2 text-right font-mono text-xs">{grid.totalCount}</td>
                  <td className="py-2 text-right font-mono text-xs">{fmtINR(grid.totalRefund)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="mt-3 rounded-md border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
            No filings recorded yet.
          </div>
        )}
      </div>

      {/* Workload by staff */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-medium text-slate-900">Workload by staff</h2>
        <p className="text-xs text-slate-500">
          Active clients assigned per user, plus pending filings where they are the preparer.
        </p>
        {staff && staff.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 text-left font-medium">Name</th>
                  <th className="py-2 text-left font-medium">Role</th>
                  <th className="py-2 text-right font-medium">Assigned clients</th>
                  <th className="py-2 text-right font-medium">Pending filings (preparer)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="py-2">
                      <div className="font-medium text-slate-900">{s.name}</div>
                      <div className="text-xs text-slate-500">{s.email}</div>
                    </td>
                    <td className="py-2 text-xs">
                      {ROLE_LABELS[s.role as keyof typeof ROLE_LABELS] ?? s.role}
                    </td>
                    <td className="py-2 text-right font-mono text-sm">{s.assignedClients}</td>
                    <td className="py-2 text-right font-mono text-sm">
                      {s.pendingFilingsAsPreparer}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-3 text-sm text-slate-500">No staff in scope.</div>
        )}
      </div>

      {/* Workload by branch */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-medium text-slate-900">Workload by branch</h2>
        {branches && branches.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 text-left font-medium">Branch</th>
                  <th className="py-2 text-left font-medium">City</th>
                  <th className="py-2 text-right font-medium">Active clients</th>
                  <th className="py-2 text-right font-medium">Pending filings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {branches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="py-2">
                      <span className="font-medium text-slate-900">{b.name}</span>
                      {b.isHq && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium uppercase text-indigo-700 ring-1 ring-inset ring-indigo-200">
                          HQ
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-xs text-slate-600">{b.city}</td>
                    <td className="py-2 text-right font-mono text-sm">{b.activeClients}</td>
                    <td className="py-2 text-right font-mono text-sm">{b.pendingFilings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-3 text-sm text-slate-500">No branches yet.</div>
        )}
      </div>
    </div>
  )
}
