import { useEffect, useRef, useState } from 'react'
import { documentsApi, fmtBytes, type DocumentItem } from '../lib/documents-api'
import { fmtDate } from '../lib/api-types'
import { useAuth } from '../lib/auth'
import { useToast, getApiErrorMessage } from '../lib/toast'
import Spinner from './Spinner'

const DELETER_ROLES = ['MANAGING_PARTNER', 'PARTNER', 'BRANCH_HEAD'] as const

interface Props {
  clientId: string
  filingId?: string
  /** Title shown above the section. Defaults to "Documents". */
  title?: string
}

export default function DocumentsSection({ clientId, filingId, title = 'Documents' }: Props) {
  const toast = useToast()
  const { user } = useAuth()
  const [items, setItems] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [category, setCategory] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const canDelete = !!user && (DELETER_ROLES as readonly string[]).includes(user.role)

  function load() {
    setLoading(true)
    documentsApi
      .list(clientId, filingId)
      .then(setItems)
      .catch((err) => toast.error(getApiErrorMessage(err)))
      .finally(() => setLoading(false))
  }

  useEffect(load, [clientId, filingId])

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      await documentsApi.upload(clientId, file, {
        category: category.trim() || undefined,
        filingId,
      })
      toast.success(`Uploaded ${file.name}`)
      setCategory('')
      if (fileInput.current) fileInput.current.value = ''
      load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload(d: DocumentItem) {
    try {
      await documentsApi.download(d.id, d.originalName)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  async function handleDelete(d: DocumentItem) {
    if (!window.confirm(`Delete ${d.originalName}? This cannot be undone.`)) return
    try {
      await documentsApi.remove(d.id)
      toast.success('Document deleted')
      load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-medium text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">
            PDF, images, Word/Excel, CSV, or text — up to 25 MB each. Stored on the firm server,
            never on a third-party cloud.
          </p>
        </div>
      </div>

      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder='Category (e.g. "Form 16", "Bank statement")'
            maxLength={60}
            className="flex-1 min-w-[200px] rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <input
            ref={fileInput}
            type="file"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleUpload(f)
            }}
            className="block max-w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-indigo-700 disabled:opacity-50"
          />
          {uploading && <Spinner size="sm" />}
        </div>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
            No documents uploaded yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 text-left font-medium">File</th>
                <th className="py-2 text-left font-medium">Category</th>
                <th className="py-2 text-left font-medium">Filing AY</th>
                <th className="py-2 text-right font-medium">Size</th>
                <th className="py-2 text-left font-medium">Uploaded by</th>
                <th className="py-2 text-left font-medium">Date</th>
                <th className="py-2 text-right font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="py-2">
                    <button
                      onClick={() => handleDownload(d)}
                      className="text-left font-medium text-indigo-700 hover:underline"
                    >
                      {d.originalName}
                    </button>
                  </td>
                  <td className="py-2 text-xs text-slate-600">{d.category ?? '—'}</td>
                  <td className="py-2 font-mono text-xs">
                    {d.filing?.assessmentYear ?? '—'}
                  </td>
                  <td className="py-2 text-right font-mono text-xs">{fmtBytes(d.size)}</td>
                  <td className="py-2 text-xs text-slate-600">{d.uploadedBy.name}</td>
                  <td className="py-2 text-xs text-slate-600">{fmtDate(d.uploadedAt)}</td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => handleDownload(d)}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      Download
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(d)}
                        className="ml-3 text-xs text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
