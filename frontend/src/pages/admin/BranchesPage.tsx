import { useEffect, useState, type FormEvent } from 'react'
import {
  branchesApi,
  usersApi,
  type BranchDetail,
  type UserDetail,
} from '../../lib/admin-api'
import { useToast, getApiErrorMessage } from '../../lib/toast'
import Spinner from '../../components/Spinner'
import { InputField, SelectField, TextareaField } from '../../components/forms/Field'

interface BranchModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  branch?: BranchDetail
  users: UserDetail[]
}

function BranchModal({ open, onClose, onSaved, branch, users }: BranchModalProps) {
  const isEdit = !!branch
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [v, setV] = useState({
    name: branch?.name ?? '',
    city: branch?.city ?? '',
    address: branch?.address ?? '',
    isHq: branch?.isHq ?? false,
    headUserId: branch?.headUserId ?? '',
  })

  useEffect(() => {
    if (open) {
      setV({
        name: branch?.name ?? '',
        city: branch?.city ?? '',
        address: branch?.address ?? '',
        isHq: branch?.isHq ?? false,
        headUserId: branch?.headUserId ?? '',
      })
    }
  }, [open, branch])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const payload = {
        name: v.name,
        city: v.city,
        address: v.address || undefined,
        isHq: v.isHq,
        headUserId: v.headUserId || undefined,
      }
      if (isEdit && branch) {
        await branchesApi.update(branch.id, payload)
        toast.success('Branch updated')
      } else {
        await branchesApi.create(payload)
        toast.success('Branch created')
      }
      onSaved()
      onClose()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-medium text-slate-900">
            {isEdit ? 'Edit branch' : 'New branch'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <form id="branch-form" onSubmit={handleSave} className="space-y-4">
            <InputField
              label="Branch name"
              required
              value={v.name}
              onChange={(e) => setV((s) => ({ ...s, name: e.target.value }))}
            />
            <InputField
              label="City"
              required
              value={v.city}
              onChange={(e) => setV((s) => ({ ...s, city: e.target.value }))}
            />
            <TextareaField
              label="Address"
              value={v.address}
              onChange={(e) => setV((s) => ({ ...s, address: e.target.value }))}
              rows={2}
            />
            <SelectField
              label="Branch Head"
              value={v.headUserId}
              onChange={(e) => setV((s) => ({ ...s, headUserId: e.target.value }))}
              placeholder="—"
              options={users.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={v.isHq}
                onChange={(e) => setV((s) => ({ ...s, isHq: e.target.checked }))}
              />
              This is the head office (HQ). Only one branch can be HQ.
            </label>
          </form>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="branch-form"
            disabled={submitting}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? <Spinner size="sm" /> : isEdit ? 'Save' : 'Create branch'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BranchesPage() {
  const toast = useToast()
  const [branches, setBranches] = useState<BranchDetail[]>([])
  const [users, setUsers] = useState<UserDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; branch?: BranchDetail }>({ open: false })

  function reload() {
    setLoading(true)
    Promise.all([branchesApi.list(), usersApi.list()])
      .then(([b, u]) => {
        setBranches(b)
        setUsers(u)
      })
      .catch((err) => toast.error(getApiErrorMessage(err)))
      .finally(() => setLoading(false))
  }

  useEffect(reload, [])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Branches</h1>
          <p className="mt-1 text-sm text-slate-500">
            Each branch has its own staff and clients. Clients are assigned to a branch and can be
            re-assigned later.
          </p>
        </div>
        <button
          onClick={() => setModal({ open: true })}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Add branch
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">City</th>
                <th className="px-4 py-3 text-left font-medium">Head</th>
                <th className="px-4 py-3 text-right font-medium">Users</th>
                <th className="px-4 py-3 text-right font-medium">Clients</th>
                <th className="px-4 py-3 text-right font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <Spinner />
                  </td>
                </tr>
              ) : branches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No branches yet.
                  </td>
                </tr>
              ) : (
                branches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{b.name}</div>
                      {b.isHq && (
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium uppercase text-blue-700 ring-1 ring-inset ring-blue-200">
                          HQ
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{b.city}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{b.head?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {b._count?.users ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {b._count?.clients ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setModal({ open: true, branch: b })}
                        className="text-xs text-blue-600 hover:underline"
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
      </div>

      <BranchModal
        open={modal.open}
        branch={modal.branch}
        users={users}
        onClose={() => setModal({ open: false })}
        onSaved={() => reload()}
      />
    </div>
  )
}
