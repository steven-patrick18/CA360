import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ClientForm from '../../components/ClientForm'
import DocumentsSection from '../../components/DocumentsSection'
import FilingDetailsPanel from '../../components/FilingDetailsPanel'
import FilingFormModal from '../../components/FilingFormModal'
import FilingImportModal from '../../components/FilingImportModal'
import Spinner from '../../components/Spinner'
import { clientsApi, credentialsApi } from '../../lib/clients-api'
import { filingsApi } from '../../lib/filings-api'
import {
  FILING_STATUS_LABELS,
  ITR_FORM_LABELS,
  PORTAL_LABELS,
  STATUS_LABELS,
  fmtDate,
  fmtINR,
  type ClientCredentialSummary,
  type ClientDetail,
  type FilingListItem,
  type FilingStatus,
  type Portal,
  type RevealedCredential,
  type UpdateClientPayload,
} from '../../lib/api-types'
import { useAuth } from '../../lib/auth'
import { useToast, getApiErrorMessage } from '../../lib/toast'

const FILING_STATUS_COLORS: Record<FilingStatus, string> = {
  PENDING: 'bg-slate-100 text-slate-700 ring-slate-200',
  DOCS_AWAITED: 'bg-amber-50 text-amber-700 ring-amber-200',
  IN_PROCESS: 'bg-blue-50 text-blue-700 ring-blue-200',
  READY: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  FILED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  ACKNOWLEDGED: 'bg-emerald-100 text-emerald-800 ring-emerald-300',
  DEFECTIVE: 'bg-red-50 text-red-700 ring-red-200',
}

const PORTALS: Portal[] = ['INCOME_TAX', 'GST', 'TRACES', 'MCA']
const REVEAL_VISIBLE_MS = 30_000

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

interface CredentialSlotProps {
  clientId: string
  portal: Portal
  existing: ClientCredentialSummary | undefined
  onChange: () => void
}

function CredentialSlot({ clientId, portal, existing, onChange }: CredentialSlotProps) {
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [username, setUsername] = useState(existing?.username ?? '')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [revealed, setRevealed] = useState<RevealedCredential | null>(null)
  const [revealRemaining, setRevealRemaining] = useState(0)

  useEffect(() => {
    setUsername(existing?.username ?? '')
  }, [existing?.username])

  // Auto-mask after REVEAL_VISIBLE_MS
  useEffect(() => {
    if (!revealed) return
    setRevealRemaining(REVEAL_VISIBLE_MS / 1000)
    const tick = setInterval(() => {
      setRevealRemaining((s) => {
        if (s <= 1) {
          clearInterval(tick)
          setRevealed(null)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [revealed])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) {
      toast.error('Username and password are required')
      return
    }
    setSubmitting(true)
    try {
      await credentialsApi.upsert(clientId, { portal, username: username.trim(), password })
      toast.success(`${PORTAL_LABELS[portal]} credentials saved`)
      setEditing(false)
      setPassword('')
      onChange()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReveal() {
    try {
      const data = await credentialsApi.reveal(clientId, portal)
      setRevealed(data)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${PORTAL_LABELS[portal]} credentials? This cannot be undone.`))
      return
    try {
      await credentialsApi.remove(clientId, portal)
      toast.success(`${PORTAL_LABELS[portal]} credentials deleted`)
      onChange()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-slate-900">{PORTAL_LABELS[portal]}</div>
          {existing ? (
            <div className="text-xs text-slate-500">
              Username: <span className="font-mono">{existing.username}</span>
            </div>
          ) : (
            <div className="text-xs text-slate-400">Not configured</div>
          )}
        </div>
        {!editing && (
          <div className="flex gap-2">
            {existing && (
              <>
                <button
                  onClick={handleReveal}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
                >
                  Reveal
                </button>
                <button
                  onClick={() => setEditing(true)}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
                >
                  Update
                </button>
                <button
                  onClick={handleDelete}
                  className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs text-red-700 hover:bg-red-50"
                >
                  Delete
                </button>
              </>
            )}
            {!existing && (
              <button
                onClick={() => setEditing(true)}
                className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
              >
                Set up
              </button>
            )}
          </div>
        )}
      </div>

      {revealed && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
          <div className="flex items-center justify-between text-xs text-amber-700">
            <span>Auto-masking in {revealRemaining}s</span>
            <button
              onClick={() => setRevealed(null)}
              className="text-amber-700 underline hover:no-underline"
            >
              Hide now
            </button>
          </div>
          <div className="mt-2">
            <span className="text-xs text-slate-500">Username</span>
            <div className="font-mono text-sm">{revealed.username}</div>
          </div>
          <div className="mt-2">
            <span className="text-xs text-slate-500">Password</span>
            <div className="font-mono text-sm">{revealed.password}</div>
          </div>
        </div>
      )}

      {editing && (
        <form onSubmit={handleSave} className="mt-3 space-y-2">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            autoComplete="off"
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={existing ? 'New password (leave blank to keep)…' : 'Password'}
            autoComplete="new-password"
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setPassword('')
                setUsername(existing?.username ?? '')
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}

      {existing && !editing && (
        <div className="mt-2 flex justify-between text-[11px] text-slate-400">
          <span>Updated {formatDate(existing.lastUpdated)}</span>
          {existing.lastRevealedAt && (
            <span>Last revealed {formatDate(existing.lastRevealedAt)}</span>
          )}
        </div>
      )}
    </div>
  )
}

interface FilingRowProps {
  filing: FilingListItem
  expandable: boolean
  isOpen: boolean
  onToggle: () => void
  onEdit: () => void
}

function FilingRow({ filing: f, expandable, isOpen, onToggle, onEdit }: FilingRowProps) {
  const toast = useToast()
  const [downloading, setDownloading] = useState(false)

  async function handleDownload(e: React.MouseEvent) {
    e.stopPropagation()
    setDownloading(true)
    try {
      await filingsApi.downloadSourceJson(f)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      <tr
        className={`${expandable ? 'cursor-pointer' : ''} hover:bg-slate-50`}
        onClick={expandable ? onToggle : undefined}
      >
        <td className="py-2 text-center text-slate-400">
          {expandable && (
            <span className="inline-block transition-transform" style={{
              transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            }}>▸</span>
          )}
        </td>
        <td className="py-2 font-mono text-xs">{f.assessmentYear}</td>
        <td className="py-2 text-xs text-slate-600">
          {f.itrForm ? ITR_FORM_LABELS[f.itrForm] : '—'}
        </td>
        <td className="py-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${FILING_STATUS_COLORS[f.status]}`}
          >
            {FILING_STATUS_LABELS[f.status]}
          </span>
        </td>
        <td className="py-2 text-xs text-slate-600">{fmtDate(f.dueDate)}</td>
        <td className="py-2 text-xs text-slate-600">{fmtDate(f.filedDate)}</td>
        <td className="py-2 text-right font-mono text-xs text-slate-700">
          {fmtINR(f.refundAmount)}
        </td>
        <td className="py-2 text-right">
          <div className="flex items-center justify-end gap-3" onClick={(e) => e.stopPropagation()}>
            {f.hasSourceJson && (
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="text-xs text-slate-600 hover:text-blue-600 hover:underline disabled:opacity-50"
                title="Download the original ITR JSON"
              >
                {downloading ? 'Downloading…' : 'Download JSON'}
              </button>
            )}
            <button
              onClick={onEdit}
              className="text-xs text-blue-600 hover:underline"
            >
              Edit
            </button>
          </div>
        </td>
      </tr>
      {isOpen && expandable && (
        <tr className="bg-slate-50/60">
          <td colSpan={8} className="px-2 py-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Computation of Income — AY {f.assessmentYear}
              </div>
              {f.acknowledgementNo && (
                <div className="text-[11px] text-slate-500">
                  Ack: <span className="font-mono">{f.acknowledgementNo}</span>
                </div>
              )}
            </div>
            <FilingDetailsPanel details={f.details} />
          </td>
        </tr>
      )}
    </>
  )
}

export default function ClientDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const [client, setClient] = useState<ClientDetail | null>(null)
  const [filings, setFilings] = useState<FilingListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [savingForm, setSavingForm] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [filingModal, setFilingModal] = useState<{ open: boolean; filing?: FilingListItem }>({
    open: false,
  })
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [expandedFilingId, setExpandedFilingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [c, fs] = await Promise.all([
        clientsApi.detail(id),
        filingsApi.list({ clientId: id, limit: 50 }),
      ])
      setClient(c)
      setFilings(fs.items)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  const reloadFilings = useCallback(async () => {
    try {
      const fs = await filingsApi.list({ clientId: id, limit: 50 })
      setFilings(fs.items)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }, [id, toast])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSave(payload: UpdateClientPayload) {
    setSavingForm(true)
    try {
      await clientsApi.update(id, payload)
      toast.success('Client updated')
      await load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSavingForm(false)
    }
  }

  async function handleArchive() {
    if (!client) return
    if (!window.confirm(`Archive ${client.name}? They'll be hidden from the default list.`)) return
    setArchiving(true)
    try {
      await clientsApi.archive(id)
      toast.success('Client archived')
      navigate('/clients')
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setArchiving(false)
    }
  }

  async function handlePermanentDelete() {
    if (!client) return
    if (
      !window.confirm(
        `PERMANENTLY DELETE ${client.name}?\n\n` +
          `This wipes the client AND all their filings, encrypted credentials, ` +
          `and uploaded documents. The audit trail keeps a record of the deletion ` +
          `but the data itself is gone for good.\n\n` +
          `Type-confirm: this cannot be undone.`,
      )
    )
      return
    try {
      await clientsApi.permanentDelete(id)
      toast.success('Client permanently deleted')
      navigate('/clients')
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="text-center text-slate-500">Client not found.</div>
    )
  }

  const canArchive =
    client.status !== 'ARCHIVED' &&
    user &&
    ['MANAGING_PARTNER', 'PARTNER', 'BRANCH_HEAD'].includes(user.role)

  const canPermanentDelete = user?.role === 'MANAGING_PARTNER'

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <Link to="/clients" className="text-sm text-blue-600 hover:underline">
          ← Back to clients
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-900">{client.name}</h1>
              <span className="text-sm text-slate-500">Sr No {client.srNo}</span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                  client.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                    : client.status === 'INACTIVE'
                      ? 'bg-slate-100 text-slate-600 ring-slate-200'
                      : 'bg-amber-50 text-amber-700 ring-amber-200'
                }`}
              >
                {STATUS_LABELS[client.status]}
              </span>
            </div>
            {client.pan && (
              <p className="mt-1 font-mono text-sm text-slate-500">PAN: {client.pan}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {canArchive && (
              <button
                onClick={handleArchive}
                disabled={archiving}
                className="rounded-md border border-amber-200 bg-white px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-50"
              >
                Archive
              </button>
            )}
            {canPermanentDelete && (
              <button
                onClick={handlePermanentDelete}
                className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                title="Wipes the client and all related data. Cannot be undone."
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Form: 2/3 width */}
        <div className="lg:col-span-2 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-medium text-slate-900">Details</h2>
          <ClientForm
            mode="edit"
            initialValues={{
              branchId: client.branchId,
              assignedUserId: client.assignedUserId ?? '',
              name: client.name,
              fatherName: client.fatherName ?? '',
              pan: client.pan ?? '',
              aadhaarLast4: client.aadharMasked ? client.aadharMasked.slice(-4) : '',
              dob: client.dob ? client.dob.split('T')[0] : '',
              typeOfAssessee: client.typeOfAssessee,
              email: client.email ?? '',
              mobile: client.mobile ?? '',
              address: client.address ?? '',
              notes: client.notes ?? '',
              status: client.status,
            }}
            onSubmit={handleSave as never}
            submitting={savingForm}
          />
        </div>

        {/* Credentials Vault: 1/3 width */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-base font-medium text-slate-900">Portal credentials</h2>
          <p className="mb-4 text-xs text-slate-500">
            Stored encrypted (AES-256-GCM, per-firm key). Each reveal is logged in the audit
            trail.
          </p>
          <div className="space-y-3">
            {PORTALS.map((p) => {
              const existing = client.credentials.find((c) => c.portal === p)
              return (
                <CredentialSlot
                  key={p}
                  clientId={client.id}
                  portal={p}
                  existing={existing}
                  onChange={() => void load()}
                />
              )
            })}
          </div>
        </div>
      </div>

      {/* ITR Filings section */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-medium text-slate-900">ITR Filings</h2>
            <p className="text-xs text-slate-500">
              Multi-year tracking for {client.name}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setImportModalOpen(true)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              title="Upload an ITR JSON downloaded from the e-Filing portal"
            >
              Fetch from JSON
            </button>
            <button
              onClick={() => setFilingModal({ open: true })}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Add filing
            </button>
          </div>
        </div>

        {filings.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            No filings yet for this client. Click "Add filing" to start.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="w-6 py-2" />
                  <th className="py-2 text-left font-medium">AY</th>
                  <th className="py-2 text-left font-medium">Form</th>
                  <th className="py-2 text-left font-medium">Status</th>
                  <th className="py-2 text-left font-medium">Due</th>
                  <th className="py-2 text-left font-medium">Filed</th>
                  <th className="py-2 text-right font-medium">Refund</th>
                  <th className="py-2 text-right font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filings.map((f) => {
                  const expandable = Boolean(f.details?.sections?.length)
                  const isOpen = expandedFilingId === f.id
                  return (
                    <FilingRow
                      key={f.id}
                      filing={f}
                      expandable={expandable}
                      isOpen={isOpen}
                      onToggle={() => setExpandedFilingId(isOpen ? null : f.id)}
                      onEdit={() => setFilingModal({ open: true, filing: f })}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Documents */}
      <DocumentsSection clientId={client.id} />

      <FilingFormModal
        open={filingModal.open}
        clientId={filingModal.filing ? undefined : client.id}
        clientType={filingModal.filing ? undefined : client.typeOfAssessee}
        filing={filingModal.filing}
        onClose={() => setFilingModal({ open: false })}
        onSaved={() => void reloadFilings()}
      />

      <FilingImportModal
        open={importModalOpen}
        clientId={client.id}
        clientName={client.name}
        onClose={() => setImportModalOpen(false)}
        onImported={() => void reloadFilings()}
      />
    </div>
  )
}
