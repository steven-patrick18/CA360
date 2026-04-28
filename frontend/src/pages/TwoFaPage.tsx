import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import Logo from '../components/Logo'
import { BRANDING } from '../lib/branding'

interface TwoFaState {
  preAuthToken: string
  stage: 'enroll_2fa' | 'verify_2fa'
  qrDataUrl?: string
  manualEntryKey?: string
  email: string
}

interface VerifyResponse {
  accessToken: string
}

export default function TwoFaPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { setSession } = useAuth()
  const state = location.state as TwoFaState | null

  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!state?.preAuthToken) {
    return <Navigate to="/login" replace />
  }

  const isEnrollment = state.stage === 'enroll_2fa'

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const { data } = await api.post<VerifyResponse>('/auth/verify-2fa', {
        preAuthToken: state!.preAuthToken,
        code: code.trim(),
      })
      await setSession(data.accessToken)
      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e?.response?.data?.message ?? 'Verification failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-blue-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={56} className="mb-2" />
          <h1 className="text-2xl font-bold tracking-tight text-blue-700">{BRANDING.appName}</h1>
          <p className="mt-1 text-sm font-medium text-slate-700">{BRANDING.firmName}</p>
          <p className="mt-1 text-xs text-slate-500">{state.email}</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          {isEnrollment && (
            <>
              <h2 className="mb-2 text-lg font-medium text-slate-900">
                Set up two-factor authentication
              </h2>
              <p className="mb-4 text-sm text-slate-600">
                Scan this QR code with Google Authenticator, Authy, or 1Password — then enter the
                6-digit code shown in the app.
              </p>
              {state.qrDataUrl && (
                <div className="mb-4 flex justify-center">
                  <img
                    src={state.qrDataUrl}
                    alt="2FA QR code"
                    className="h-48 w-48 rounded-md border border-slate-200"
                  />
                </div>
              )}
              {state.manualEntryKey && (
                <details className="mb-4 text-xs text-slate-500">
                  <summary className="cursor-pointer">Can't scan? Enter the key manually</summary>
                  <code className="mt-2 block break-all rounded bg-slate-100 p-2 font-mono">
                    {state.manualEntryKey}
                  </code>
                </details>
              )}
            </>
          )}
          {!isEnrollment && (
            <>
              <h2 className="mb-2 text-lg font-medium text-slate-900">
                Enter your authentication code
              </h2>
              <p className="mb-4 text-sm text-slate-600">
                Open your authenticator app and enter the current 6-digit code for CA360.
              </p>
            </>
          )}

          <form onSubmit={onSubmit}>
            {error && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <label className="mb-5 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">6-digit code</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                required
                autoComplete="one-time-code"
                autoFocus
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-center font-mono text-lg tracking-widest focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="000000"
              />
            </label>

            <button
              type="submit"
              disabled={submitting || code.length !== 6}
              className="w-full rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Verifying…' : isEnrollment ? 'Verify and enable' : 'Verify'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
