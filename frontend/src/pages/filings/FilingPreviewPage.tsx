import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { filingsApi } from '../../lib/filings-api'
import {
  FILING_STATUS_LABELS,
  ITR_FORM_LABELS,
  fmtDate,
  fmtINR,
  type FilingListItem,
} from '../../lib/api-types'
import { useAuth } from '../../lib/auth'
import { useToast, getApiErrorMessage } from '../../lib/toast'
import Spinner from '../../components/Spinner'

/**
 * Print-friendly Computation of Income page. The whole layout is sized for
 * A4 portrait. The toolbar at the top is hidden in print (`print:hidden`),
 * so what the user sees on screen IS what comes out of "Save as PDF" /
 * "Print" — no surprises.
 */
export default function FilingPreviewPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { user } = useAuth()
  const toast = useToast()
  const [filing, setFiling] = useState<FilingListItem | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    filingsApi
      .detail(id)
      .then((f) => {
        if (!cancelled) setFiling(f)
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
  }, [id, toast])

  // Set the document title so "Save as PDF" suggests a sensible filename.
  useEffect(() => {
    if (!filing) return
    const prev = document.title
    const safeName = filing.client.name.replace(/[^A-Za-z0-9 _-]/g, '')
    document.title = `COI — ${safeName} — AY ${filing.assessmentYear}`
    return () => {
      document.title = prev
    }
  }, [filing])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!filing) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="text-slate-500">Filing not found.</p>
        <Link to="/clients" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
          ← Back to clients
        </Link>
      </div>
    )
  }

  const sections = filing.details?.sections ?? []
  const hasCOI = sections.length > 0

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      {/* Toolbar — hidden in print */}
      <div className="print:hidden sticky top-0 z-10 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <Link
            to={`/clients/${filing.clientId}`}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back to client
          </Link>
          <div className="flex items-center gap-2">
            {filing.hasSourceJson && (
              <button
                type="button"
                onClick={() => filingsApi.downloadSourceJson(filing).catch((e) => toast.error(getApiErrorMessage(e)))}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Download JSON
              </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Print / Save as PDF
            </button>
          </div>
        </div>
      </div>

      {/* A4 sheet */}
      <div className="mx-auto my-6 max-w-4xl bg-white p-10 shadow-sm print:my-0 print:max-w-none print:p-8 print:shadow-none">
        {/* Letterhead */}
        <header className="mb-6 flex items-start justify-between border-b-2 border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            {user?.firmLogoDataUrl ? (
              <img
                src={user.firmLogoDataUrl}
                alt={user.firmName}
                className="h-14 w-14 object-contain"
              />
            ) : (
              <img src="/ca-logo.svg" alt="CA360" className="h-14 w-14" />
            )}
            <div>
              <div className="text-xl font-bold text-slate-900">
                {user?.firmName ?? 'CA Firm'}
              </div>
              <div className="text-xs text-slate-500">Chartered Accountants</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-base font-semibold text-slate-900">Computation of Income</div>
            <div className="mt-1 text-xs text-slate-600">
              Assessment Year <span className="font-mono">{filing.assessmentYear}</span>
            </div>
            {filing.itrForm && (
              <div className="text-xs text-slate-600">
                Form: <span className="font-mono">{ITR_FORM_LABELS[filing.itrForm]}</span>
              </div>
            )}
          </div>
        </header>

        {/* Assessee + filing summary */}
        <section className="mb-6 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Assessee</div>
            <div className="font-medium text-slate-900">{filing.client.name}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">PAN</div>
            <div className="font-mono text-slate-900">{filing.client.pan ?? '—'}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Status</div>
            <div className="text-slate-900">{FILING_STATUS_LABELS[filing.status]}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Filed on</div>
            <div className="text-slate-900">{fmtDate(filing.filedDate)}</div>
          </div>
          {filing.acknowledgementNo && (
            <div className="col-span-2">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Acknowledgement no.</div>
              <div className="font-mono text-slate-900">{filing.acknowledgementNo}</div>
            </div>
          )}
        </section>

        {/* COI sections */}
        {hasCOI ? (
          <section className="space-y-5">
            {sections.map((s) => (
              <div key={s.title} className="break-inside-avoid">
                <h3 className="mb-1.5 border-b border-slate-300 pb-1 text-sm font-semibold uppercase tracking-wide text-slate-700">
                  {s.title}
                </h3>
                <table className="w-full text-sm">
                  <tbody>
                    {s.rows.map((r, i) => (
                      <tr key={i} className="align-baseline">
                        <td className="py-1 pr-4 text-slate-700">{r.label}</td>
                        <td
                          className={
                            typeof r.value === 'number'
                              ? 'py-1 text-right font-mono tabular-nums text-slate-900'
                              : 'py-1 text-right text-slate-900'
                          }
                        >
                          {typeof r.value === 'number'
                            ? fmtINR(r.value)
                            : (r.value ?? '—')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </section>
        ) : (
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
            No structured details on file. Re-import the ITR JSON to generate the
            computation sheet.
          </div>
        )}

        {/* Bottom totals strip — quick at-a-glance numbers */}
        <section className="mt-8 grid grid-cols-3 gap-4 border-t-2 border-slate-800 pt-4">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Gross income</div>
            <div className="font-mono text-base text-slate-900">{fmtINR(filing.grossIncome)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Tax paid</div>
            <div className="font-mono text-base text-slate-900">{fmtINR(filing.taxPaid)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Refund / Payable</div>
            <div className="font-mono text-base text-slate-900">{fmtINR(filing.refundAmount)}</div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-10 border-t border-slate-200 pt-3 text-[10px] text-slate-500">
          <div className="flex justify-between">
            <span>Generated from imported e-Filing JSON via CA360</span>
            <span>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
