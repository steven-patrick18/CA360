import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { auditApi, exportApi, usersApi, type AuditLogItem, type UserDetail } from '../../lib/admin-api'
import Spinner from '../../components/Spinner'
import { useToast, getApiErrorMessage } from '../../lib/toast'

const PAGE_SIZE = 50

const KNOWN_ENTITIES = [
  'client',
  'itr_filing',
  'client_credential',
  'document',
  'user',
  'branch',
]

const KNOWN_ACTIONS = [
  'CREATE',
  'UPDATE',
  'ARCHIVE',
  'IMPORT_CLIENTS',
  'UPSERT_CREDENTIAL',
  'REVEAL_CREDENTIAL',
  'DELETE_CREDENTIAL',
  'UPLOAD_DOCUMENT',
  'DOWNLOAD_DOCUMENT',
  'DELETE_DOCUMENT',
  'CHANGE_PASSWORD',
  'RESET_PASSWORD',
  'STATUS_CHANGE_FILED',
  'STATUS_CHANGE_ACKNOWLEDGED',
]

export default function AuditLogPage() {
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const action = params.get('action') ?? ''
  const entityType = params.get('entityType') ?? ''
  const userId = params.get('userId') ?? ''
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const offset = Number(params.get('offset') ?? 0)

  const [items, setItems] = useState<AuditLogItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserDetail[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function reload() {
    setLoading(true)
    auditApi
      .list({
        action: action || undefined,
        entityType: entityType || undefined,
        userId: userId || undefined,
        from: from || undefined,
        to: to ? `${to}T23:59:59` : undefined,
        limit: PAGE_SIZE,
        offset,
      })
      .then((r) => {
        setItems(r.items)
        setTotal(r.total)
      })
      .catch((err) => toast.error(getApiErrorMessage(err)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    usersApi
      .list()
      .then(setUsers)
      .catch(() => {
        /* non-blocking */
      })
  }, [])

  useEffect(reload, [action, entityType, userId, from, to, offset])

  function updateParam(k: string, v: string) {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    next.delete('offset')
    setParams(next)
  }

  function goToPage(newOffset: number) {
    const next = new URLSearchParams(params)
    if (newOffset > 0) next.set('offset', String(newOffset))
    else next.delete('offset')
    setParams(next)
  }

  function toggle(id: string) {
    setExpanded((s) => {
      const ns = new Set(s)
      if (ns.has(id)) ns.delete(id)
      else ns.add(id)
      return ns
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Audit log</h1>
          <p className="mt-1 text-sm text-slate-500">
            Append-only record of every mutation made through the app. Useful for compliance and
            forensic review.
          </p>
        </div>
        <button
          onClick={() =>
            exportApi
              .download('/export/audit-log')
              .catch((e) => toast.error(getApiErrorMessage(e)))
          }
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Export full log .xlsx
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <select
            value={action}
            onChange={(e) => updateParam('action', e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All actions</option>
            {KNOWN_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select
            value={entityType}
            onChange={(e) => updateParam('entityType', e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All entities</option>
            {KNOWN_ENTITIES.map((e2) => (
              <option key={e2} value={e2}>
                {e2}
              </option>
            ))}
          </select>
          <select
            value={userId}
            onChange={(e) => updateParam('userId', e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={from}
            onChange={(e) => updateParam('from', e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="From"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => updateParam('to', e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="To"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Time</th>
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-left font-medium">Action</th>
                <th className="px-4 py-3 text-left font-medium">Entity</th>
                <th className="px-4 py-3 text-left font-medium">IP</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <Spinner />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No audit entries match the filters.
                  </td>
                </tr>
              ) : (
                items.map((it) => (
                  <>
                    <tr key={it.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">
                        {new Date(it.createdAt).toLocaleString('en-IN', { hour12: false })}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {it.user ? (
                          <>
                            <div className="text-slate-900">{it.user.name}</div>
                            <div className="text-slate-500">{it.user.email}</div>
                          </>
                        ) : (
                          <span className="text-slate-400">system</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{it.action}</td>
                      <td className="px-4 py-3 text-xs">
                        <div className="text-slate-700">{it.entityType}</div>
                        {it.entityId && (
                          <div className="font-mono text-[10px] text-slate-400">{it.entityId}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {it.ipAddress ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {it.payloadJson && (
                          <button
                            onClick={() => toggle(it.id)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            {expanded.has(it.id) ? 'Hide' : 'Details'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expanded.has(it.id) && it.payloadJson && (
                      <tr key={`${it.id}-detail`}>
                        <td colSpan={6} className="bg-slate-50 px-4 py-2">
                          <pre className="overflow-x-auto text-[11px] text-slate-700">
                            {JSON.stringify(it.payloadJson, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
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
