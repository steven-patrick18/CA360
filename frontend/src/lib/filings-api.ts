import { api } from './api'
import type {
  CreateFilingPayload,
  DashboardStats,
  FilingListItem,
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
}

export const dashboardApi = {
  async stats(): Promise<DashboardStats> {
    const { data } = await api.get<DashboardStats>('/dashboard/stats')
    return data
  },
}
