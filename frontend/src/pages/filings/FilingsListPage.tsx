import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { filingsApi } from '../../lib/filings-api'
import {
  FILING_STATUS_LABELS,
  ITR_FORM_LABELS,
  fmtDate,
  fmtINR,
  recentAssessmentYears,
  type FilingListItem,
  type FilingStatus,
  type ItrForm,
} from '../../lib/api-types'
import Spinner from '../../components/Spinner'
import FilingFormModal from '../../components/FilingFormModal'
import { useToast, getApiErrorMessage } from '../../lib/toast'

const PAGE_SIZE = 25

const STATUS_COLORS: Record<FilingStatus, string> = {
  PENDING: 'bg-slate-100 text-slate-700 ring-slate-200',
  DOCS_AWAITED: 'bg-amber-50 text-amber-700 ring-amber-200',
  IN_PROCESS: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  READY: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  FILED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  ACKNOWLEDGED: 'bg-emerald-100 text-emerald-800 ring-emerald-300',
  DEFECTIVE: 'bg-red-50 text-red-700 ring-red-200',
}

function StatusBadge({ status }: { status: FilingStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_COLORS[status]}`}
    >
      {FILING_STATUS_LABELS[status]}
    </span>
  )
}

export default function FilingsListPage() {
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') as FilingStatus | null) ?? ''
  const ay = params.get('ay') ?? ''
  const form = (params.get('form') as ItrForm | null) ?? ''
  const offset = Number(params.get('offset') ?? 0)

  const [items, setItems] = useState<FilingListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; filing?: FilingListItem }>({ open: false })
  const toast = useToast()

  const ays = recentAssessmentYears(6)

  function reload() {
    setLoading(true)
    filingsApi
      .list({
        status: status || undefined,
        assessmentYear: ay || undefined,
        itrForm: form || undefined,
        limit: PAGE_SIZE,
        offset,
      })
      .then((res) => {
        setItems(res.items)
        setTotal(res.total)
      })
      .catch((err) => toast.error(getApiErrorMessage(err)))
      .finally(() => setLoading(false))
  }

  useEffect(reload, [status, ay, form, offset])

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('offset')
    setParams(next)
  }

  function goToPage(newOffset: number) {
    const next = new URLSearchParams(params)
    if (newOffset > 0) next.set('offset', String(newOffset))
    else next.delete('offset')
    setParams(next)
  }

  const hasFilters = !!(status || ay || form)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">ITR Filings</h1>
          <p className="mt-1 text-sm text-slate-500">
            {total === 0 && !hasFilters
              ? 'No filings yet — add the first one to start tracking.'
              : `${total} ${total === 1 ? 'filing' : 'filings'}${hasFilters ? ' matching filters' : ''}`}
          </p>
        </div>
        <button
          onClick={() => setModal({ open: true })}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + New filing
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={ay}
            onChange={(e) => updateParam('ay', e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All assessment years</option>
            {ays.map((y) => (
              <option key={y} value={y}>
                AY {y}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => updateParam('status', e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All statuses</option>
            {Object.entries(FILING_STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select
            value={form}
            onChange={(e) => updateParam('form', e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All ITR forms</option>
            {Object.entries(ITR_FORM_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          {hasFilters && (
            <button
              onClick={() => setParams(new URLSearchParams())}
              className="text-sm text-indigo-600 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">AY</th>
                <th className="px-4 py-3 text-left font-medium">Client</th>
                <th className="px-4 py-3 text-left font-medium">Form</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Due</th>
                <th className="px-4 py-3 text-left font-medium">Filed</th>
                <th className="px-4 py-3 text-right font-medium">Refund</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center">
                    <Spinner />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    {hasFilters ? 'No filings match your filters.' : 'No filings yet.'}
                  </td>
                </tr>
              ) : (
                items.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs">{f.assessmentYear}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{f.client.name}</div>
                      <div className="text-xs text-slate-500">
                        #{f.client.srNo}
                        {f.client.pan ? ` · ${f.client.pan}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {f.itrForm ? ITR_FORM_LABELS[f.itrForm] : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={f.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{fmtDate(f.dueDate)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{fmtDate(f.filedDate)}</td>
                    <td className="px-4 py-3 text-right text-xs font-mono text-slate-700">
                      {fmtINR(f.refundAmount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setModal({ open: true, filing: f })}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
            <span>
              Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button
                disabled={offset === 0}
                onClick={() => goToPage(Math.max(0, offset - PAGE_SIZE))}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => goToPage(offset + PAGE_SIZE)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <FilingFormModal
        open={modal.open}
        filing={modal.filing}
        onClose={() => setModal({ open: false })}
        onSaved={() => reload()}
      />
    </div>
  )
}
