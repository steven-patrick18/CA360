import { useEffect, useState, type FormEvent } from 'react'
import { profileApi, type MyProfile } from '../lib/admin-api'
import { useAuth, ROLE_LABELS, type UserRole } from '../lib/auth'
import { useToast, getApiErrorMessage } from '../lib/toast'
import { InputField } from '../components/forms/Field'
import Spinner from '../components/Spinner'

export default function SettingsPage() {
  const toast = useToast()
  const { logout } = useAuth()

  const [me, setMe] = useState<MyProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // Profile form state
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    profileApi
      .me()
      .then((p) => {
        setMe(p)
        setName(p.name)
        setMobile(p.mobile ?? '')
      })
      .catch((err) => toast.error(getApiErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [toast])

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    if (!me) return
    if (name.trim() === me.name && (mobile.trim() || null) === me.mobile) {
      toast.info('No changes to save')
      return
    }
    setSavingProfile(true)
    try {
      await profileApi.update({
        name: name.trim() !== me.name ? name.trim() : undefined,
        mobile: mobile.trim() !== (me.mobile ?? '') ? mobile.trim() : undefined,
      })
      toast.success('Profile updated')
      const refreshed = await profileApi.me()
      setMe(refreshed)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSavingProfile(false)
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault()
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    if (newPassword === currentPassword) {
      toast.error('New password must differ from current password')
      return
    }
    setChangingPassword(true)
    try {
      await profileApi.changePassword({ currentPassword, newPassword })
      toast.success('Password changed — sign in again on your other devices')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setChangingPassword(false)
    }
  }

  if (loading || !me) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your own profile, password, and 2FA. To change your role or branch, ask a Managing
          Partner.
        </p>
      </div>

      {/* Account info (read-only) */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-medium text-slate-900">Account</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-slate-500">Email</dt>
            <dd className="mt-1 font-mono">{me.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Role</dt>
            <dd className="mt-1">{ROLE_LABELS[me.role as UserRole] ?? me.role}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Firm</dt>
            <dd className="mt-1">{me.firmName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Branch</dt>
            <dd className="mt-1">{me.branchName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Two-factor auth</dt>
            <dd className="mt-1">
              {me.twoFaEnabled ? (
                <span className="text-emerald-700">Enrolled</span>
              ) : (
                <span className="text-amber-700">Not yet enrolled</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Last login</dt>
            <dd className="mt-1 text-slate-700">
              {me.lastLoginAt ? new Date(me.lastLoginAt).toLocaleString('en-IN') : 'Never'}
            </dd>
          </div>
        </dl>
      </div>

      {/* Editable profile */}
      <form
        onSubmit={saveProfile}
        className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-base font-medium text-slate-900">Profile</h2>
        <p className="mb-4 text-xs text-slate-500">
          Email cannot be changed (it's your login). Ask a Managing Partner if you need it updated.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <InputField
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
          />
          <InputField
            label="Mobile"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            maxLength={20}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={savingProfile}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {savingProfile ? <Spinner size="sm" /> : 'Save profile'}
          </button>
        </div>
      </form>

      {/* Change password */}
      <form
        onSubmit={changePassword}
        className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-base font-medium text-slate-900">Change password</h2>
        <p className="mb-4 text-xs text-slate-500">
          Pick a strong password — at least 8 characters, ideally a passphrase or random string from
          a password manager. Other sessions stay signed in but you'll need the new password next
          time you log in.
        </p>
        <div className="space-y-4">
          <InputField
            label="Current password"
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <InputField
            label="New password"
            type="password"
            required
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
          />
          <InputField
            label="Confirm new password"
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            error={
              confirmPassword && newPassword !== confirmPassword ? 'Passwords do not match' : undefined
            }
          />
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {changingPassword ? <Spinner size="sm" /> : 'Change password'}
          </button>
        </div>
      </form>

      {/* Sign out */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-medium text-slate-900">Sign out everywhere</h2>
        <p className="mt-1 text-xs text-slate-500">
          Forces your other tabs to re-authenticate. To sign out everywhere on every device, change
          your password — that invalidates other sessions on next API call.
        </p>
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => logout()}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
