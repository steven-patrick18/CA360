import { api } from './api'
import type {
  CreateFilingPayload,
  DashboardStats,
  FilingListItem,
  ItrDetails,
  PaginatedFilings,
  UpdateFilingPayload,
} from './api-types'

export interface ListFilingsParams {
  clientId?: string
  assessmentYear?: string
  status?: string
  itrForm?: string
  branchId?: string
  limit?: number
  offset?: number
}

export const filingsApi = {
  async list(params: ListFilingsParams = {}): Promise<PaginatedFilings> {
    const { data } = await api.get<PaginatedFilings>('/filings', { params })
    return data
  },

  async detail(id: string): Promise<FilingListItem> {
    const { data } = await api.get<FilingListItem>(`/filings/${id}`)
    return data
  },

  async create(payload: CreateFilingPayload): Promise<FilingListItem> {
    const { data } = await api.post<FilingListItem>('/filings', payload)
    return data
  },

  async update(id: string, payload: UpdateFilingPayload): Promise<FilingListItem> {
    const { data } = await api.patch<FilingListItem>(`/filings/${id}`, payload)
    return data
  },

  async remove(id: string): Promise<{ ok: true }> {
    const { data } = await api.delete<{ ok: true }>(`/filings/${id}`)
    return data
  },

  async importFromJson(clientId: string, file: File): Promise<ImportItrResponse> {
    const fd = new FormData()
    fd.append('file', file)
    const { data } = await api.post<ImportItrResponse>(`/filings/import/${clientId}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  /**
   * Trigger a browser download of the original ITR JSON for a filing.
   * Falls back to a friendly error if no JSON was ever imported.
   */
  async downloadSourceJson(filing: Pick<FilingListItem, 'id' | 'sourceFilename' | 'assessmentYear' | 'client'>): Promise<void> {
    const res = await api.get<Blob>(`/filings/${filing.id}/source-json`, {
      responseType: 'blob',
    })
    const fallback = `${(filing.client.pan || filing.client.name).replace(/\s+/g, '_')}_AY${filing.assessmentYear}.json`
    const filename = filing.sourceFilename || fallback
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  },
}

export interface ImportItrResponse {
  filing: { id: string; assessmentYear: string; status: string }
  parsed: {
    pan: string
    assessmentYear: string
    itrForm: string | null
    filedDate: string | null
    acknowledgementNo: string | null
    grossIncome: number | null
    taxPaid: number | null
    refundAmount: number | null
    details: ItrDetails
    notes: string[]
  }
  created: boolean
}

export const dashboardApi = {
  async stats(): Promise<DashboardStats> {
    const { data } = await api.get<DashboardStats>('/dashboard/stats')
    return data
  },
}
