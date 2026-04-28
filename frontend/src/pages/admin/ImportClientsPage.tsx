import { useState } from 'react'
import { Link } from 'react-router-dom'
import { importApi, type ImportResult } from '../../lib/admin-api'
import { useToast, getApiErrorMessage } from '../../lib/toast'
import Spinner from '../../components/Spinner'

export default function ImportClientsPage() {
  const toast = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  async function handleUpload() {
    if (!file) return
    setSubmitting(true)
    setResult(null)
    try {
      const r = await importApi.clients(file)
      setResult(r)
      if (r.errorCount === 0) {
        toast.success(`Imported ${r.successCount} client${r.successCount === 1 ? '' : 's'}`)
      } else {
        toast.info(`Imported ${r.successCount} of ${r.totalRows} (${r.errorCount} errors)`)
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link to="/clients" className="text-sm text-blue-600 hover:underline">
          ← Back to clients
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Import clients from Excel</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload an .xlsx or .xls file. Each row becomes a client. Duplicates (matching PAN) and
          rows with invalid data are skipped and reported below.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-medium text-slate-900">Expected columns</h2>
        <p className="mt-1 text-xs text-slate-500">
          Column names are case-insensitive. Extra columns are ignored.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-700 md:grid-cols-3">
          <div>
            <strong>Name</strong> <span className="text-red-500">*</span>
          </div>
          <div>PAN</div>
          <div>Father Name</div>
          <div>Aadhaar (last 4 or full 12)</div>
          <div>DOB</div>
          <div>Type (Individual / HUF / LLP / etc.)</div>
          <div>Email</div>
          <div>Mobile</div>
          <div>Address</div>
          <div>Branch (name; defaults to HQ)</div>
          <div>Assigned To (email or name)</div>
          <div>Notes</div>
        </div>
        <p className="mt-3 text-xs text-amber-700">
          ⚠ Aadhaar entries are stored masked (XXXX-XXXX-NNNN). The file is processed in memory and
          not saved to disk.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null)
            setResult(null)
          }}
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700"
        />
        {file && (
          <div className="mt-3 flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-600">
              {file.name} <span className="text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
            </span>
            <button
              onClick={handleUpload}
              disabled={submitting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? <Spinner size="sm" /> : 'Upload and import'}
            </button>
          </div>
        )}
      </div>

      {result && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-medium text-slate-900">Import result</h2>
          <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-md bg-slate-50 p-3">
              <div className="text-xs uppercase text-slate-500">Total rows</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{result.totalRows}</div>
            </div>
            <div className="rounded-md bg-emerald-50 p-3">
              <div className="text-xs uppercase text-emerald-700">Imported</div>
              <div className="mt-1 text-2xl font-semibold text-emerald-800">
                {result.successCount}
              </div>
            </div>
            <div
              className={`rounded-md p-3 ${result.errorCount > 0 ? 'bg-red-50' : 'bg-slate-50'}`}
            >
              <div
                className={`text-xs uppercase ${result.errorCount > 0 ? 'text-red-700' : 'text-slate-500'}`}
              >
                Errors
              </div>
              <div
                className={`mt-1 text-2xl font-semibold ${result.errorCount > 0 ? 'text-red-800' : 'text-slate-900'}`}
              >
                {result.errorCount}
              </div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-slate-700">
                Show errors ({result.errors.length})
              </summary>
              <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Row</th>
                      <th className="px-3 py-2 text-left font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {result.errors.map((e, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5 font-mono text-xs">{e.row}</td>
                        <td className="px-3 py-1.5 text-xs text-red-700">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {result.successCount > 0 && (
            <div className="mt-4 flex justify-end">
              <Link
                to="/clients"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                View clients →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
