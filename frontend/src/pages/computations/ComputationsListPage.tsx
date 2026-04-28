import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { computationsApi, type ComputationListItem } from '../../lib/computations-api'
import { fmtINR } from '../../lib/api-types'
import { REGIME_LABELS, AGE_LABELS, SUPPORTED_AYS } from '../../lib/tax-calculator'
import Spinner from '../../components/Spinner'
import { useToast, getApiErrorMessage } from '../../lib/toast'

const PAGE_SIZE = 50

export default function ComputationsListPage() {
  const [params, setParams] = useSearchParams()
  const ay = params.get('ay') ?? ''
  const regime = (params.get('regime') as 'OLD' | 'NEW' | null) ?? ''
  const offset = Number(params.get('offset') ?? 0)

  const [items, setItems] = useState<ComputationListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    computationsApi
      .list({
        assessmentYear: ay || undefined,
        regime: (regime as 'OLD' | 'NEW') || undefined,
        limit: PAGE_SIZE,
        offset,
      })
      .then((res) => {
        if (!cancelled) {
          setItems(res.items)
          setTotal(res.total)
        }
      })
      .catch((err) => {
        if (!cancelled) toast.error(getApiErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [ay, regime, offset, toast])

  function updateFilter(patch: Record<string, string>) {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    next.delete('offset')
    setParams(next)
  }

  async function handleDelete(c: ComputationListItem) {
    if (!window.confirm(`Delete this computation for ${c.client.name} (AY ${c.assessmentYear})?`)) return
    try {
      await computationsApi.remove(c.id)
      toast.success('Computation deleted')
      setItems((xs) => xs.filter((x) => x.id !== c.id))
      setTotal((t) => t - 1)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  // Quick at-a-glance totals for the visible rows.
  const totalPayable = items.reduce(
    (s, c) => s + Math.max(0, Number(c.taxPayable ?? 0)),
    0,
  )
  const totalRefund = items.reduce(
    (s, c) => s + Math.max(0, -Number(c.taxPayable ?? 0)),
    0,
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tax Computations</h1>
          <p className="mt-1 text-sm text-slate-500">
            Per-client income tax calculations. Slabs, surcharge, cess, and rebate are
            computed automatically based on AY + regime.
          </p>
        </div>
        <Link
          to="/computations/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + New computation
        </Link>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Tile label="Saved computations" value={String(total)} />
        <Tile label="Tax payable (visible rows)" value={fmtINR(totalPayable)} tone="warn" />
        <Tile label="Refunds expected (visible rows)" value={fmtINR(totalRefund)} tone="ok" />
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={ay}
            onChange={(e) => updateFilter({ ay: e.target.value })}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All assessment years</option>
            {SUPPORTED_AYS.map((a) => (
              <option key={a} value={a}>
                AY {a}
              </option>
            ))}
          </select>
          <select
            value={regime}
            onChange={(e) => updateFilter({ regime: e.target.value })}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All regimes</option>
            <option value="NEW">{REGIME_LABELS.NEW}</option>
            <option value="OLD">{REGIME_LABELS.OLD}</option>
          </select>
          {(ay || regime) && (
            <button
              onClick={() => setParams(new URLSearchParams())}
              className="text-sm text-blue-600 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Client</th>
                <th className="px-4 py-3 text-left font-medium">AY</th>
                <th className="px-4 py-3 text-left font-medium">Regime</th>
                <th className="px-4 py-3 text-left font-medium">Age</th>
                <th className="px-4 py-3 text-right font-medium">Total Income</th>
                <th className="px-4 py-3 text-right font-medium">Tax Payable / Refund</th>
                <th className="px-4 py-3 text-left font-medium">Updated</th>
                <th className="px-4 py-3 text-right font-medium" />
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
                    No computations yet — click "New computation" to add the first one.
                  </td>
                </tr>
              ) : (
                items.map((c) => {
                  const payable = Number(c.taxPayable ?? 0)
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link
                          to={`/computations/${c.id}`}
                          className="font-medium text-blue-700 hover:underline"
                        >
                          {c.client.name}
                        </Link>
                        {c.client.pan && (
                          <div className="font-mono text-xs text-slate-500">{c.client.pan}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{c.assessmentYear}</td>
                      <td className="px-4 py-3 text-xs text-slate-700">
                        {REGIME_LABELS[c.regime]}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {AGE_LABELS[c.ageCategory]}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {fmtINR(c.computed?.totalIncome)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-block rounded-md px-2 py-0.5 font-mono text-xs ${
                            payable > 0
                              ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                              : payable < 0
                                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                                : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
                          }`}
                        >
                          {payable > 0
                            ? fmtINR(payable)
                            : payable < 0
                              ? `Refund ${fmtINR(-payable)}`
                              : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(c.updatedAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/computations/${c.id}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Open
                        </Link>
                        <button
                          onClick={() => handleDelete(c)}
                          className="ml-3 text-xs text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'warn' | 'ok' }) {
  const toneCls =
    tone === 'warn'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : tone === 'ok'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
        : 'border-slate-200 bg-white text-slate-900'
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${toneCls}`}>
      <div className="text-[11px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 font-mono text-xl font-semibold">{value}</div>
    </div>
  )
}
