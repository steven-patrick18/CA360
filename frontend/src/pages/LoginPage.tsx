import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import Logo from '../components/Logo'
import { BRANDING } from '../lib/branding'

interface LoginResponse {
  stage: 'enroll_2fa' | 'verify_2fa'
  preAuthToken: string
  qrDataUrl?: string
  manualEntryKey?: string
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const { data } = await api.post<LoginResponse>('/auth/login', { email, password })
      navigate('/2fa', {
        state: {
          preAuthToken: data.preAuthToken,
          stage: data.stage,
          qrDataUrl: data.qrDataUrl,
          manualEntryKey: data.manualEntryKey,
          email,
        },
      })
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e?.response?.data?.message ?? 'Login failed. Check your credentials.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-blue-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={64} className="mb-3" />
          <h1 className="text-2xl font-bold text-slate-900">{BRANDING.firmName}</h1>
          <p className="mt-1 text-sm text-slate-500">{BRANDING.tagline}</p>
          <p className="mt-1 text-[10px] uppercase tracking-wide text-blue-600">
            powered by {BRANDING.appName}
          </p>
        </div>
        <form
          onSubmit={onSubmit}
          className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="mb-4 text-lg font-medium text-slate-900">Sign in to your account</h2>

          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <label className="mb-3 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="you@firm.com"
            />
          </label>

          <label className="mb-5 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Signing in…' : 'Continue'}
          </button>

          <p className="mt-4 text-center text-xs text-slate-500">
            Two-factor authentication is required for all accounts.
          </p>
        </form>
      </div>
    </div>
  )
}
