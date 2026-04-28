import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usersApi, branchesApi, type UserDetail, type BranchDetail } from '../../lib/admin-api'
import { ROLE_LABELS } from '../../lib/auth'
import { useToast, getApiErrorMessage } from '../../lib/toast'
import Spinner from '../../components/Spinner'
import { InputField, SelectField } from '../../components/forms/Field'

const ROLE_VALUES = [
  'MANAGING_PARTNER',
  'PARTNER',
  'BRANCH_HEAD',
  'SENIOR_ARTICLE',
  'ARTICLE',
  'ACCOUNTANT',
] as const

interface UserModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  user?: UserDetail
  branches: BranchDetail[]
}

function UserModal({ open, onClose, onSaved, user, branches }: UserModalProps) {
  const isEdit = !!user
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [v, setV] = useState({
    email: user?.email ?? '',
    name: user?.name ?? '',
    role: user?.role ?? 'ARTICLE',
    branchId: user?.branchId ?? '',
    mobile: user?.mobile ?? '',
    isActive: user?.isActive ?? true,
  })

  useEffect(() => {
    if (open) {
      setV({
        email: user?.email ?? '',
        name: user?.name ?? '',
        role: user?.role ?? 'ARTICLE',
        branchId: user?.branchId ?? '',
        mobile: user?.mobile ?? '',
        isActive: user?.isActive ?? true,
      })
      setTempPassword(null)
    }
  }, [open, user])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (isEdit && user) {
        await usersApi.update(user.id, {
          name: v.name,
          role: v.role,
          branchId: v.branchId || undefined,
          mobile: v.mobile || undefined,
          isActive: v.isActive,
        })
        toast.success('User updated')
        onSaved()
        onClose()
      } else {
        const created = await usersApi.create({
          email: v.email,
          name: v.name,
          role: v.role,
          branchId: v.branchId || undefined,
          mobile: v.mobile || undefined,
        })
        toast.success(`User ${created.name} created`)
        if (created.tempPassword) {
          setTempPassword(created.tempPassword)
        } else {
          onSaved()
          onClose()
        }
      }
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
            {isEdit ? 'Edit user' : 'New user'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {tempPassword ? (
            <div className="space-y-4">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
                <h3 className="text-sm font-medium text-emerald-800">User created</h3>
                <p className="mt-1 text-sm text-emerald-700">
                  Share this temporary password with them. They'll be prompted to enroll 2FA on
                  first login. <strong>This password is only shown once.</strong>
                </p>
                <div className="mt-3 rounded-md bg-white px-3 py-2 font-mono text-sm">
                  {tempPassword}
                </div>
              </div>
              <button
                onClick={() => {
                  onSaved()
                  onClose()
                }}
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          ) : (
            <form id="user-form" onSubmit={handleSave} className="space-y-4">
              <InputField
                label="Email"
                type="email"
                required
                disabled={isEdit}
                value={v.email}
                onChange={(e) => setV((s) => ({ ...s, email: e.target.value }))}
                hint={isEdit ? 'Email cannot be changed after creation' : undefined}
              />
              <InputField
                label="Name"
                required
                value={v.name}
                onChange={(e) => setV((s) => ({ ...s, name: e.target.value }))}
              />
              <SelectField
                label="Role"
                required
                value={v.role}
                onChange={(e) => setV((s) => ({ ...s, role: e.target.value }))}
                options={ROLE_VALUES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
              />
              <SelectField
                label="Branch"
                value={v.branchId}
                onChange={(e) => setV((s) => ({ ...s, branchId: e.target.value }))}
                placeholder="Unassigned"
                options={branches.map((b) => ({
                  value: b.id,
                  label: `${b.name} — ${b.city}${b.isHq ? ' (HQ)' : ''}`,
                }))}
              />
              <InputField
                label="Mobile"
                value={v.mobile}
                onChange={(e) => setV((s) => ({ ...s, mobile: e.target.value }))}
              />
              {isEdit && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={v.isActive}
                    onChange={(e) => setV((s) => ({ ...s, isActive: e.target.checked }))}
                  />
                  Active (can log in)
                </label>
              )}
              {!isEdit && (
                <p className="text-xs text-slate-500">
                  A temporary password will be generated and shown once after creation.
                </p>
              )}
            </form>
          )}
        </div>

        {!tempPassword && (
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
              form="user-form"
              disabled={submitting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? <Spinner size="sm" /> : isEdit ? 'Save' : 'Create user'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function UsersPage() {
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const editId = params.get('edit')
  const [users, setUsers] = useState<UserDetail[]>([])
  const [branches, setBranches] = useState<BranchDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; user?: UserDetail }>({ open: false })

  function reload() {
    setLoading(true)
    Promise.all([usersApi.list(), branchesApi.list()])
      .then(([u, b]) => {
        setUsers(u)
        setBranches(b)
      })
      .catch((err) => toast.error(getApiErrorMessage(err)))
      .finally(() => setLoading(false))
  }

  useEffect(reload, [])

  // If we arrived here from /access with ?edit=<id>, auto-open the edit modal
  // for that user once the list loads.
  useEffect(() => {
    if (!editId || users.length === 0 || modal.open) return
    const target = users.find((u) => u.id === editId)
    if (target) setModal({ open: true, user: target })
    // Clear the param so refresh / back doesn't re-open
    const next = new URLSearchParams(params)
    next.delete('edit')
    setParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, users])

  async function handleResetPassword(user: UserDetail) {
    if (!window.confirm(`Reset ${user.name}'s password? They'll need to enroll 2FA again.`)) return
    try {
      const { tempPassword } = await usersApi.resetPassword(user.id)
      window.prompt(
        `New temporary password for ${user.email}. Copy this — it's shown once.`,
        tempPassword,
      )
      toast.success('Password reset; share new password with user')
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  async function handleDelete(user: UserDetail) {
    if (
      !window.confirm(
        `Permanently delete ${user.name} (${user.email})?\n\n` +
          `This cannot be undone. Their assigned clients become unassigned, and ` +
          `their name on past audit-log entries / filings becomes blank. If you ` +
          `just want to revoke access, edit them and toggle "Active" off instead.`,
      )
    )
      return
    try {
      await usersApi.remove(user.id)
      toast.success(`Deleted ${user.name}`)
      reload()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Users</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage staff who can sign in to CA360. Each user must enroll 2FA on first login.
          </p>
        </div>
        <button
          onClick={() => setModal({ open: true })}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Add user
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Role</th>
                <th className="px-4 py-3 text-left font-medium">Branch</th>
                <th className="px-4 py-3 text-left font-medium">2FA</th>
                <th className="px-4 py-3 text-left font-medium">Last login</th>
                <th className="px-4 py-3 text-right font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <Spinner />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No users yet.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className={`hover:bg-slate-50 ${!u.isActive ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{u.name}</div>
                      {!u.isActive && (
                        <span className="text-xs text-red-600">Deactivated</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{u.email}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {u.branch?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {u.twoFaEnabled ? (
                        <span className="text-emerald-600">Enrolled</span>
                      ) : (
                        <span className="text-amber-600">Not yet</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleString('en-IN')
                        : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setModal({ open: true, user: u })}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleResetPassword(u)}
                        className="ml-3 text-xs text-amber-700 hover:underline"
                      >
                        Reset password
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        className="ml-3 text-xs text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UserModal
        open={modal.open}
        user={modal.user}
        branches={branches}
        onClose={() => setModal({ open: false })}
        onSaved={() => reload()}
      />
    </div>
  )
}
