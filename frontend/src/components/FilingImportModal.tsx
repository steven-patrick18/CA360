import { useRef, useState } from 'react'
import { filingsApi, type ImportItrResponse } from '../lib/filings-api'
import { fmtINR, ITR_FORM_LABELS, FILING_STATUS_LABELS, type ItrForm, type FilingStatus } from '../lib/api-types'
import { useToast, getApiErrorMessage } from '../lib/toast'
import Spinner from './Spinner'

interface Props {
  open: boolean
  clientId: string
  clientName: string
  onClose: () => void
  /** Called after a successful import so the parent can refresh its filings list. */
  onImported: () => void
}

export default function FilingImportModal({ open, clientId, clientName, onClose, onImported }: Props) {
  const toast = useToast()
  const fileInput = useRef<HTMLInputElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ImportItrResponse | null>(null)

  if (!open) return null

  async function handleFile(file: File) {
    setSubmitting(true)
    setResult(null)
    try {
      const r = await filingsApi.importFromJson(clientId, file)
      setResult(r)
      toast.success(
        r.created
          ? `Filing for AY ${r.filing.assessmentYear} created from ${file.name}`
          : `Filing for AY ${r.filing.assessmentYear} updated from ${file.name}`,
      )
      onImported()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSubmitting(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-medium text-slate-900">Import ITR from JSON</h2>
            <p className="text-xs text-slate-500">For {clientName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {/* How-to */}
          <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
            <strong>How to get the file:</strong>
            <ol className="mt-1 list-decimal pl-5 space-y-0.5">
              <li>Sign in to the e-Filing portal as the taxpayer.</li>
              <li>Go to <em>e-File → Income Tax Returns → View Filed Returns</em>.</li>
              <li>Click <em>Download JSON</em> for the relevant Assessment Year.</li>
              <li>Drop that .json file below.</li>
            </ol>
            <p className="mt-2 text-[11px] text-blue-700">
              We never log in to the portal on your behalf — that would violate the IT Department's
              terms. The PAN inside the file is verified against the client's PAN before saving.
            </p>
          </div>

          {/* File picker */}
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4">
            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              disabled={submitting}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700 disabled:opacity-50"
            />
            {submitting && (
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                <Spinner size="sm" /> Parsing and saving…
              </div>
            )}
          </div>

          {/* Result */}
          {result && (
            <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-sm font-medium text-emerald-900">
                {result.created ? 'New filing created' : 'Filing updated'} — AY {result.filing.assessmentYear}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-emerald-900">
                <div>
                  <dt className="text-emerald-700">PAN</dt>
                  <dd className="font-mono">{result.parsed.pan}</dd>
                </div>
                <div>
                  <dt className="text-emerald-700">ITR form</dt>
                  <dd>
                    {result.parsed.itrForm
                      ? ITR_FORM_LABELS[result.parsed.itrForm as ItrForm]
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-emerald-700">Status</dt>
                  <dd>{FILING_STATUS_LABELS[result.filing.status as FilingStatus]}</dd>
                </div>
                <div>
                  <dt className="text-emerald-700">Filed date</dt>
                  <dd>{result.parsed.filedDate ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-emerald-700">Ack no</dt>
                  <dd className="font-mono">{result.parsed.acknowledgementNo ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-emerald-700">Gross income</dt>
                  <dd>{fmtINR(result.parsed.grossIncome)}</dd>
                </div>
                <div>
                  <dt className="text-emerald-700">Tax paid</dt>
                  <dd>{fmtINR(result.parsed.taxPaid)}</dd>
                </div>
                <div>
                  <dt className="text-emerald-700">Refund</dt>
                  <dd>{fmtINR(result.parsed.refundAmount)}</dd>
                </div>
              </dl>
              {result.parsed.notes.length > 0 && (
                <div className="mt-3 border-t border-emerald-200 pt-2 text-[11px] text-emerald-800">
                  <strong>Notes:</strong>
                  <ul className="mt-1 list-disc pl-5">
                    {result.parsed.notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            {result ? 'Done' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}
