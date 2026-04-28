import { api } from './api'

export interface DocumentItem {
  id: string
  clientId: string
  filingId: string | null
  category: string | null
  originalName: string
  size: number
  mime: string
  uploadedAt: string
  uploadedBy: { id: string; name: string }
  filing?: { id: string; assessmentYear: string } | null
}

export const documentsApi = {
  async list(clientId: string, filingId?: string): Promise<DocumentItem[]> {
    const { data } = await api.get<DocumentItem[]>(`/clients/${clientId}/documents`, {
      params: filingId ? { filingId } : {},
    })
    return data
  },

  async upload(
    clientId: string,
    file: File,
    options: { category?: string; filingId?: string } = {},
  ): Promise<DocumentItem> {
    const fd = new FormData()
    fd.append('file', file)
    if (options.category) fd.append('category', options.category)
    if (options.filingId) fd.append('filingId', options.filingId)
    const { data } = await api.post<DocumentItem>(`/clients/${clientId}/documents`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  async download(id: string, fallbackName: string) {
    const res = await api.get(`/documents/${id}/download`, { responseType: 'blob' })
    const disposition: string = res.headers['content-disposition'] ?? ''
    const match = /filename="?([^"]+)"?/.exec(disposition)
    const filename = match?.[1] ?? fallbackName
    const blob = new Blob([res.data as BlobPart], {
      type: (res.headers['content-type'] as string) ?? 'application/octet-stream',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  },

  async remove(id: string): Promise<{ ok: true }> {
    const { data } = await api.delete<{ ok: true }>(`/documents/${id}`)
    return data
  },
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}
