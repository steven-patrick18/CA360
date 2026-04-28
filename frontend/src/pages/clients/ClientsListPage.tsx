import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { clientsApi } from '../../lib/clients-api'
import { exportApi } from '../../lib/admin-api'
import {
  CLIENT_TYPE_LABELS,
  STATUS_LABELS,
  type ClientListItem,
  type ClientStatus,
  type ClientType,
} from '../../lib/api-types'
import Spinner from '../../components/Spinner'
import { useToast, getApiErrorMessage } from '../../lib/toast'

const PAGE_SIZE = 25

function StatusBadge({ status }: { status: ClientStatus }) {
  const map: Record<ClientStatus, string> = {
    ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    INACTIVE: 'bg-slate-100 text-slate-600 ring-slate-200',
    ARCHIVED: 'bg-amber-50 text-amber-700 ring-amber-200',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${map[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

export default function ClientsListPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const status = (params.get('status') as ClientStatus | null) ?? ''
  const type = (params.get('type') as ClientType | null) ?? ''
  const offset = Number(params.get('offset') ?? 0)

  const [items, setItems] = useState<ClientListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState(q)
  const toast = useToast()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    clientsApi
      .list({
        q: q || undefined,
        status: status || undefined,
        typeOfAssessee: type || undefined,
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
  }, [q, status, type, offset, toast])

  function updateParams(patch: Record<string, string>) {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    next.delete('offset') // reset pagination on filter change
    setParams(next)
  }

  function goToPage(newOffset: number) {
    const next = new URLSearchParams(params)
    if (newOffset > 0) next.set('offset', String(newOffset))
    else next.delete('offset')
    setParams(next)
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault()
    updateParams({ q: searchInput.trim() })
  }

  const hasFilters = q || status || type

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Clients</h1>
          <p className="mt-1 text-sm text-slate-500">
            {total === 0 && !hasFilters
              ? 'No clients yet — add your first one to get started.'
              : `${total} ${total === 1 ? 'client' : 'clients'}${hasFilters ? ' matching filters' : ''}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              exportApi
                .download('/export/clients')
                .catch((e) => toast.error(getApiErrorMessage(e)))
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Export Excel
          </button>
          <Link
            to="/clients/import"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Import
          </Link>
          <Link
            to="/clients/new"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Add client
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={onSearch} className="flex flex-1 items-center gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name, PAN, email, or mobile…"
              className="w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Search
            </button>
          </form>
          <select
            value={status}
            onChange={(e) => updateParams({ status: e.target.value })}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select
            value={type}
            onChange={(e) => updateParams({ type: e.target.value })}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All types</option>
            {Object.entries(CLIENT_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          {hasFilters && (
            <button
              onClick={() => {
                setSearchInput('')
                setParams(new URLSearchParams())
              }}
              className="text-sm text-blue-600 hover:underline"
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
                <th className="px-4 py-3 text-left font-medium">Sr No</th>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">PAN</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Branch</th>
                <th className="px-4 py-3 text-left font-medium">Assigned</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <Spinner />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    {hasFilters ? 'No clients match your filters.' : 'No clients yet.'}
                  </td>
                </tr>
              ) : (
                items.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{c.srNo}</td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/clients/${c.id}`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {c.name}
                      </Link>
                      {c.email && <div className="text-xs text-slate-500">{c.email}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{c.pan ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {CLIENT_TYPE_LABELS[c.typeOfAssessee]}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{c.branch.name}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {c.assignedTo?.name ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
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
    </div>
  )
}
