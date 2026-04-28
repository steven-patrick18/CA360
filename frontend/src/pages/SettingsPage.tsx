import { useEffect, useRef, useState, type FormEvent } from 'react'
import { firmsApi, profileApi, type FirmSettings, type MyProfile } from '../lib/admin-api'
import { useAuth, ROLE_LABELS, type UserRole } from '../lib/auth'
import { useToast, getApiErrorMessage } from '../lib/toast'
import { InputField } from '../components/forms/Field'
import Spinner from '../components/Spinner'

export default function SettingsPage() {
  const toast = useToast()
  const { logout, refresh: refreshAuth } = useAuth()

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

  // Firm settings state (Managing Partner only)
  const [firm, setFirm] = useState<FirmSettings | null>(null)
  const [firmName, setFirmName] = useState('')
  const [firmPan, setFirmPan] = useState('')
  const [firmRegNo, setFirmRegNo] = useState('')
  const [firmAddress, setFirmAddress] = useState('')
  const [savingFirm, setSavingFirm] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInput = useRef<HTMLInputElement>(null)

  const isMP = me?.role === 'MANAGING_PARTNER'

  function applyFirm(f: FirmSettings) {
    setFirm(f)
    setFirmName(f.name)
    setFirmPan(f.pan ?? '')
    setFirmRegNo(f.registrationNo ?? '')
    setFirmAddress(f.address ?? '')
  }

  useEffect(() => {
    profileApi
      .me()
      .then(async (p) => {
        setMe(p)
        setName(p.name)
        setMobile(p.mobile ?? '')
        if (p.role === 'MANAGING_PARTNER') {
          const f = await firmsApi.me()
          applyFirm(f)
        }
      })
      .catch((err) => toast.error(getApiErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [toast])

  async function saveFirm(e: FormEvent) {
    e.preventDefault()
    if (!firm) return
    setSavingFirm(true)
    try {
      const updated = await firmsApi.update({
        name: firmName.trim() !== firm.name ? firmName.trim() : undefined,
        pan: firmPan.trim() !== (firm.pan ?? '') ? firmPan.trim() || undefined : undefined,
        registrationNo:
          firmRegNo.trim() !== (firm.registrationNo ?? '') ? firmRegNo.trim() || undefined : undefined,
        address: firmAddress !== (firm.address ?? '') ? firmAddress || undefined : undefined,
      })
      applyFirm(updated)
      await refreshAuth() // sidebar / header pick up the new firm name
      toast.success('Firm details updated')
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSavingFirm(false)
    }
  }

  async function handleLogoFile(file: File) {
    setUploadingLogo(true)
    try {
      const { logoDataUrl } = await firmsApi.uploadLogo(file)
      if (firm) setFirm({ ...firm, logoDataUrl })
      await refreshAuth() // sidebar logo refreshes immediately
      toast.success('Logo uploaded')
      if (logoInput.current) logoInput.current.value = ''
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setUploadingLogo(false)
    }
  }

  async function clearLogo() {
    if (!window.confirm('Remove the firm logo? The default placeholder will be shown instead.'))
      return
    try {
      await firmsApi.clearLogo()
      if (firm) setFirm({ ...firm, logoDataUrl: null })
      await refreshAuth()
      toast.success('Logo cleared')
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

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

      {/* Firm settings — Managing Partner only */}
      {isMP && firm && (
        <form
          onSubmit={saveFirm}
          className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-base font-medium text-slate-900">Firm settings</h2>
          <p className="mb-4 text-xs text-slate-500">
            Visible to all staff and shown on the sidebar, login screen, and Excel exports.
          </p>

          {/* Logo block */}
          <div className="mb-5 flex flex-wrap items-center gap-4 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-md border border-slate-200 bg-white">
              <img
                src={firm.logoDataUrl || '/ca-logo.svg'}
                alt="Firm logo"
                className="max-h-16 max-w-16 object-contain"
              />
            </div>
            <div className="flex-1 min-w-[220px]">
              <div className="text-sm font-medium text-slate-900">Firm logo</div>
              <div className="text-xs text-slate-500">
                SVG, PNG, JPG, or WebP. Max 500 KB. Displayed at consistent size across the app
                (your image is fit-to-box without distortion).
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  ref={logoInput}
                  type="file"
                  accept="image/svg+xml,image/png,image/jpeg,image/webp"
                  disabled={uploadingLogo}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleLogoFile(f)
                  }}
                  className="block text-xs file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-blue-700 disabled:opacity-50"
                />
                {uploadingLogo && <Spinner size="sm" />}
                {firm.logoDataUrl && !uploadingLogo && (
                  <button
                    type="button"
                    onClick={clearLogo}
                    className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
                  >
                    Remove logo
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InputField
              label="Firm name"
              required
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              maxLength={120}
            />
            <InputField
              label="PAN"
              value={firmPan}
              onChange={(e) => setFirmPan(e.target.value.toUpperCase())}
              maxLength={15}
              placeholder="ABCDE1234F"
            />
            <InputField
              label="Registration No"
              value={firmRegNo}
              onChange={(e) => setFirmRegNo(e.target.value)}
              maxLength={50}
            />
          </div>
          <div className="mt-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Address</span>
              <textarea
                value={firmAddress}
                onChange={(e) => setFirmAddress(e.target.value)}
                rows={2}
                maxLength={500}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={savingFirm}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {savingFirm ? <Spinner size="sm" /> : 'Save firm details'}
            </button>
          </div>
        </form>
      )}

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
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
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
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
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
